import express from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { createInviteSchema, acceptInviteSchema, staffCodeSchema, formatZodError } from '../schemas/authSchemas.js';
import { hashPassword, validatePasswordStrength } from '../auth/passwords.js';
import { generateOpaqueToken, hashOpaqueToken } from '../auth/tokens.js';
import { requireRole } from '../middleware/authorize.js';
import { findUserByEmail, createUser, toSafeUser } from '../repositories/usersRepo.js';
import { createInvite, findInviteByTokenHash, markInviteAccepted, revokeInvite, listInvites } from '../repositories/invitesRepo.js';
import { logAudit } from '../repositories/auditLogsRepo.js';
import { sendSalesManagerInviteEmail } from '../services/email/index.js';
import { createStaffSignupCode, listStaffSignupCodes, revokeStaffSignupCode } from '../repositories/staffSignupCodesRepo.js';

const router = express.Router();
const APP_URL = process.env.APP_URL || 'http://localhost:5174';

const inviteLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 });

router.post('/codes', requireRole('ADMIN'), inviteLimiter, async (req, res) => {
  const parsed = staffCodeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const { email, role } = parsed.data;
  if (await findUserByEmail(email)) return res.status(400).json({ success: false, message: 'A user with this email already exists.' });

  const code = `IBS-${crypto.randomBytes(8).toString('hex').toUpperCase().match(/.{1,4}/g).join('-')}`;
  const record = await createStaffSignupCode({ email, role, codeHash: hashOpaqueToken(code), createdBy: req.user.id });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'STAFF_SIGNUP_CODE_CREATED', entity: 'Staff Signup Code', entityId: record.id, newValue: `${role} for ${email}`, ip: req.ip });
  res.status(201).json({ success: true, code, email, role, expiresAt: record.expiresAt });
});

router.get('/codes', requireRole('ADMIN'), async (_req, res) => {
  res.json({ success: true, codes: await listStaffSignupCodes() });
});

router.delete('/codes/:id', requireRole('ADMIN'), async (req, res) => {
  const revoked = await revokeStaffSignupCode(req.params.id);
  if (!revoked) return res.status(404).json({ success: false, message: 'Unused code not found.' });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'STAFF_SIGNUP_CODE_REVOKED', entity: 'Staff Signup Code', entityId: req.params.id, ip: req.ip });
  res.json({ success: true });
});

// Sales-manager provisioning is admin-only and always server-assigned —
// the client never gets to request a role for the invitee.
router.post('/', requireRole('ADMIN'), inviteLimiter, async (req, res) => {
  const parsed = createInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  }
  const { email } = parsed.data;

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    return res.status(400).json({ success: false, message: 'A user with this email already exists' });
  }

  const rawToken = generateOpaqueToken();
  const invite = await createInvite({ email, invitedBy: req.user.id, tokenHash: hashOpaqueToken(rawToken) });

  sendSalesManagerInviteEmail(email, `${APP_URL}/auth/accept-invite?token=${rawToken}`).catch((e) =>
    console.error('Failed to send invite email:', e)
  );

  await logAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'SALES_MANAGER_INVITED',
    entity: 'Invite',
    entityId: invite.id,
    newValue: email,
    ip: req.ip
  });

  res.status(201).json({ success: true, invite: { id: invite.id, email: invite.email, expiresAt: invite.expiresAt } });
});

router.get('/', requireRole('ADMIN'), async (req, res) => {
  const invites = await listInvites();
  res.json({ success: true, invites });
});

router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  await revokeInvite(req.params.id);
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'INVITE_REVOKED', entity: 'Invite', entityId: req.params.id, ip: req.ip });
  res.json({ success: true });
});

// Public: the invitee uses the emailed token to set their own password and
// activate the account. Role always comes from the invite record.
router.post('/accept', inviteLimiter, async (req, res) => {
  const parsed = acceptInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  }
  const { token, name, password } = parsed.data;

  const strength = validatePasswordStrength(password);
  if (!strength.valid) {
    return res.status(400).json({ success: false, message: strength.errors.join('. ') });
  }

  const invite = await findInviteByTokenHash(hashOpaqueToken(token));
  if (!invite) {
    return res.status(400).json({ success: false, message: 'This invitation is invalid or has expired.' });
  }

  const existingUser = await findUserByEmail(invite.email);
  if (existingUser) {
    return res.status(400).json({ success: false, message: 'An account already exists for this email.' });
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser({ name, email: invite.email, passwordHash, role: 'SALES_MANAGER' });
  await markInviteAccepted(invite.id);

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    action: 'SALES_MANAGER_ACTIVATED',
    entity: 'User',
    entityId: user.id,
    ip: req.ip
  });

  res.status(201).json({ success: true, user: toSafeUser(user) });
});

export default router;
