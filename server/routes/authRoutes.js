import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  updateProfileSchema,
  staffRegisterSchema,
  changePasswordSchema,
  changeEmailSchema,
  formatZodError
} from '../schemas/authSchemas.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../auth/passwords.js';
import { signSessionToken, verifySessionToken, generateOpaqueToken, hashOpaqueToken, sessionCookieMaxAgeMs, sessionTtlSeconds } from '../auth/tokens.js';
import { db } from '../db/client.js';
import {
  findUserByEmail,
  findUserByPhone,
  duplicateUserField,
  updateUserEmail,
  findUserById,
  createUser,
  createFirstAdminIfAbsent,
  countAdmins,
  updateUserProfile,
  updateUserPassword,
  markEmailVerified,
  registerFailedLogin,
  clearFailedLogins,
  toSafeUser
} from '../repositories/usersRepo.js';
import { createSession, revokeSession, revokeAllSessionsForUser } from '../repositories/sessionsRepo.js';
import { createToken, consumeToken } from '../repositories/tokensRepo.js';
import { recordLoginAttempt } from '../repositories/loginAttemptsRepo.js';
import { logAudit } from '../repositories/auditLogsRepo.js';
import { requireAuth } from '../middleware/authorize.js';
import { getCookieName, sessionCookieOptions } from '../middleware/session.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email/index.js';
import { PERMISSIONS } from '../auth/permissions.js';
import { registerWithStaffCode } from '../repositories/staffSignupCodesRepo.js';
import {
  getReferralSummary, generateReferralCode, resolveReferralCode, attributeReferral, qualifyReferral, ReferralError
} from '../repositories/referralRepo.js';
import { normalizeKenyanPhone } from '../services/location.js';

const router = express.Router();
const COOKIE_NAME = getCookieName();
const APP_URL = process.env.APP_URL || 'http://localhost:5174';

const DUPLICATE_MESSAGES = {
  email: { success: false, code: 'EMAIL_TAKEN', field: 'email', message: 'An account with this email already exists. Sign in, or reset your password if you forgot it.' },
  phone: { success: false, code: 'PHONE_TAKEN', field: 'phone', message: 'This phone number is already registered to another account. Use a different number.' },
  unknown: { success: false, code: 'ACCOUNT_EXISTS', message: 'An account with these details already exists.' }
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' }
});
const referralCodeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many referral code requests. Try again later.' }
});
const staffSignupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many staff signup attempts. Try again later.' }
});

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, { ...sessionCookieOptions(), maxAge: sessionCookieMaxAgeMs() });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, sessionCookieOptions());
}

// Only called from /login: registration never signs the user in.
async function establishSession(req, res, user) {
  const session = await createSession({
    userId: user.id,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });
  const token = await signSessionToken({ userId: user.id, role: user.role, sessionId: session.id });
  setSessionCookie(res, token);
  return session;
}

async function sendVerification(user) {
  const rawToken = generateOpaqueToken();
  await createToken('verify', { userId: user.id, tokenHash: hashOpaqueToken(rawToken), ttlMs: 24 * 60 * 60 * 1000 });
  sendVerificationEmail(user.email, `${APP_URL}/auth/verify-email?token=${rawToken}`, user.name).catch((e) =>
    console.error('Failed to send verification email:', e)
  );
}

// -----------------------------------------------------------------------
// Registration — always CUSTOMER. Role is never accepted from the client.
// Creates the account only: the customer must then sign in explicitly, so no
// session cookie is issued here.
// -----------------------------------------------------------------------
router.post('/register', authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  }
  const { name, email, phone, password, referralCode, location } = parsed.data;

  const strength = validatePasswordStrength(password);
  if (!strength.valid) {
    return res.status(400).json({ success: false, message: strength.errors.join('. ') });
  }

  // Every email and every phone number belongs to exactly one account.
  const normalizedPhone = normalizeKenyanPhone(phone);
  if (await findUserByEmail(email)) return res.status(409).json(DUPLICATE_MESSAGES.email);
  if (await findUserByPhone(normalizedPhone)) return res.status(409).json(DUPLICATE_MESSAGES.phone);

  let referral = null;
  if (referralCode) {
    referral = await resolveReferralCode(referralCode);
    if (referral.error) return res.status(400).json({ success: false, message: referral.error });
  }

  const passwordHash = await hashPassword(password);
  let user;
  try {
    user = await db.transaction(async (tx) => {
      const created = await createUser({
        name, email, phone: normalizedPhone, passwordHash, role: 'CUSTOMER', location
      }, tx);
      if (referral) {
        await attributeReferral(tx, { referrerId: referral.referrerId, referredUserId: created.id, codeId: referral.codeId, ip: req.ip, referredEmail: email });
      }
      return created;
    });
  } catch (err) {
    // Two signups racing for the same email/phone: the unique index decides.
    const field = duplicateUserField(err);
    if (field) return res.status(409).json(DUPLICATE_MESSAGES[field] || DUPLICATE_MESSAGES.email);
    throw err;
  }

  await sendVerification(user);
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    action: 'USER_REGISTER',
    entity: 'User',
    entityId: user.id,
    newValue: 'CUSTOMER account created',
    ip: req.ip
  });

  res.status(201).json({
    success: true,
    requiresLogin: true,
    message: 'Account created. Please sign in to continue.',
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

// This status only controls the first-admin signup form. The write route uses
// a database lock and rechecks the state, so it is not trusted for security.
router.get('/staff-signup-status', async (_req, res) => {
  const noAdmins = Number(await countAdmins()) === 0;
  const bootstrapEmailConfigured = !!process.env.ADMIN_EMAIL?.trim();
  res.json({
    success: true,
    firstAdminAvailable: noAdmins && bootstrapEmailConfigured,
    bootstrapEmailRequired: noAdmins && !bootstrapEmailConfigured
  });
});

// With no admins, exactly one request can claim the initial ADMIN account and
// it does not need an invitation code. Later staff registrations must present
// an admin-issued, email-bound, single-use code.
router.post('/staff-register', staffSignupLimiter, async (req, res) => {
  const parsed = staffRegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const { name, email, password, invitationCode } = parsed.data;
  const phone = parsed.data.phone ? normalizeKenyanPhone(parsed.data.phone) : null;
  const strength = validatePasswordStrength(password);
  if (!strength.valid) return res.status(400).json({ success: false, message: strength.errors.join('. ') });
  if (await findUserByEmail(email)) return res.status(409).json(DUPLICATE_MESSAGES.email);
  if (phone && await findUserByPhone(phone)) return res.status(409).json(DUPLICATE_MESSAGES.phone);

  const passwordHash = await hashPassword(password);
  let user;
  try {
    if (invitationCode) {
      const result = await registerWithStaffCode({
        codeHash: hashOpaqueToken(invitationCode), name, email, phone, passwordHash, referredBy: null
      });
      if (result.error === 'existing_user') return res.status(409).json(DUPLICATE_MESSAGES.email);
      if (result.error) return res.status(400).json({ success: false, message: 'This staff code is invalid, expired, already used, or issued to another email.' });
      user = result.user;
    } else {
      const bootstrapEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      if (!bootstrapEmail) {
        return res.status(503).json({ success: false, message: 'First-admin setup is not configured. Set ADMIN_EMAIL on the server, then try again.' });
      }
      if (email !== bootstrapEmail) {
        return res.status(403).json({ success: false, message: 'The first administrator email must match the server-configured ADMIN_EMAIL.' });
      }
      user = await createFirstAdminIfAbsent({ name, email, phone, passwordHash, referredBy: null });
      if (!user) return res.status(403).json({ success: false, message: 'The first administrator has already registered. Ask an administrator for a staff signup code.' });
    }
  } catch (err) {
    const field = duplicateUserField(err);
    if (field) return res.status(409).json(DUPLICATE_MESSAGES[field] || DUPLICATE_MESSAGES.email);
    throw err;
  }
  await sendVerification(user);
  await logAudit({ actorId: user.id, actorName: user.name, action: 'STAFF_REGISTER', entity: 'User', entityId: user.id, newValue: user.role, ip: req.ip });
  res.status(201).json({
    success: true,
    requiresLogin: true,
    message: 'Staff account created. Please sign in to continue.',
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

// -----------------------------------------------------------------------
// Referrals — each code is valid for 3 hours; generating a new one revokes
// the previous one.
// -----------------------------------------------------------------------
router.get('/referrals', requireAuth, async (req, res) => {
  res.json({ success: true, ...(await getReferralSummary(req.user.id)) });
});

router.post('/referrals/code', requireAuth, referralCodeLimiter, async (req, res) => {
  if (req.user.role !== 'CUSTOMER') {
    return res.status(403).json({ success: false, message: 'Referral codes are for customer accounts only.' });
  }
  try {
    const code = await generateReferralCode(req.user.id, { ip: req.ip });
    await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'REFERRAL_CODE_GENERATED', entity: 'Referral', entityId: code.id, ip: req.ip });
    res.status(201).json({ success: true, code: code.code, expiresAt: code.expiresAt });
  } catch (err) {
    if (err instanceof ReferralError) return res.status(err.status).json({ success: false, message: err.message });
    throw err;
  }
});

// -----------------------------------------------------------------------
// Login — password is required and verified. Role is never accepted from
// the client; it always comes from the stored user record.
// -----------------------------------------------------------------------
router.post('/login', authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Invalid email or password' });
  }
  const { email, password, portal } = parsed.data;
  const genericError = { success: false, message: 'Invalid email or password' };

  const user = await findUserByEmail(email);

  if (!user) {
    await recordLoginAttempt({ email, ip: req.ip, success: false });
    return res.status(401).json(genericError);
  }

  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    await recordLoginAttempt({ email, ip: req.ip, success: false });
    return res.status(423).json({ success: false, message: 'Account temporarily locked due to repeated failed attempts. Try again later.' });
  }

  if (!user.isActive) {
    await recordLoginAttempt({ email, ip: req.ip, success: false });
    return res.status(401).json(genericError);
  }

  const validPassword = await verifyPassword(user.passwordHash, password);
  if (!validPassword) {
    await registerFailedLogin(user.id);
    await recordLoginAttempt({ email, ip: req.ip, success: false });
    await logAudit({ actorId: user.id, actorName: user.name, action: 'LOGIN_FAILED', entity: 'Authentication', ip: req.ip });
    return res.status(401).json(genericError);
  }

  // Each kind of account has one front door. The password was correct, so
  // saying which portal to use reveals nothing an attacker could exploit.
  const isStaffAccount = user.role === 'ADMIN' || user.role === 'SALES_MANAGER';
  if (isStaffAccount && portal !== 'staff') {
    await logAudit({ actorId: user.id, actorName: user.name, action: 'LOGIN_WRONG_PORTAL', entity: 'Authentication', newValue: 'store', ip: req.ip });
    return res.status(403).json({ success: false, code: 'USE_STAFF_PORTAL', message: 'Staff accounts sign in through the Staff Portal only.', portalUrl: '/admin/login' });
  }
  if (!isStaffAccount && portal === 'staff') {
    return res.status(403).json({ success: false, code: 'USE_STORE_SIGNIN', message: 'This portal is for staff only. Customers sign in on the store.', portalUrl: '/auth' });
  }

  await clearFailedLogins(user.id);
  await recordLoginAttempt({ email, ip: req.ip, success: true });
  const session = await establishSession(req, res, user);
  await logAudit({ actorId: user.id, actorName: user.name, action: 'LOGIN_SUCCESS', entity: 'Authentication', ip: req.ip });

  res.json({
    success: true,
    user: toSafeUser(user),
    permissions: PERMISSIONS[user.role],
    sessionExpiresAt: session.expiresAt,
    sessionTtlSeconds: sessionTtlSeconds()
  });
});

router.post('/logout', async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      const { sessionId } = await verifySessionToken(token);
      await revokeSession(sessionId);
    } catch {
      // token already invalid — nothing to revoke
    }
  }
  clearSessionCookie(res);
  res.json({ success: true });
});

router.post('/logout-all', requireAuth, async (req, res) => {
  await revokeAllSessionsForUser(req.user.id);
  clearSessionCookie(res);
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'LOGOUT_ALL_DEVICES', entity: 'Authentication', ip: req.ip });
  res.json({ success: true });
});

router.get('/me', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!req.user) {
    return res.json({ success: true, user: null, permissions: [], sessionExpired: !!req.sessionExpired });
  }
  const user = await findUserById(req.user.id);
  res.json({
    success: true,
    user: toSafeUser(user),
    permissions: PERMISSIONS[req.user.role] || [],
    sessionExpiresAt: req.user.sessionExpiresAt
  });
});

router.put('/profile', requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  }
  const patch = { ...parsed.data };
  if (patch.phone !== undefined) {
    patch.phone = patch.phone ? normalizeKenyanPhone(patch.phone) : null;
    if (!patch.phone && req.user.role === 'CUSTOMER') {
      return res.status(400).json({ success: false, message: 'Customers need a phone number for M-Pesa and delivery.' });
    }
    const owner = patch.phone ? await findUserByPhone(patch.phone) : null;
    if (owner && owner.id !== req.user.id) return res.status(409).json(DUPLICATE_MESSAGES.phone);
  }
  let updated;
  try {
    updated = await updateUserProfile(req.user.id, patch);
  } catch (err) {
    if (duplicateUserField(err) === 'phone') return res.status(409).json(DUPLICATE_MESSAGES.phone);
    throw err;
  }
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'PROFILE_UPDATE', entity: 'User', entityId: req.user.id, ip: req.ip });
  res.json({ success: true, user: toSafeUser(updated) });
});

// Change password while signed in. Every other session is signed out; this
// one is re-issued so the user stays signed in here.
router.post('/change-password', requireAuth, authLimiter, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const { currentPassword, newPassword } = parsed.data;
  const user = await findUserById(req.user.id);
  if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) {
    return res.status(400).json({ success: false, message: 'Your current password is incorrect.' });
  }
  const strength = validatePasswordStrength(newPassword);
  if (!strength.valid) return res.status(400).json({ success: false, message: strength.errors.join('. ') });
  if (await verifyPassword(user.passwordHash, newPassword)) {
    return res.status(400).json({ success: false, message: 'Choose a password different from your current one.' });
  }
  await updateUserPassword(user.id, await hashPassword(newPassword));
  await revokeAllSessionsForUser(user.id);
  const session = await establishSession(req, res, user);
  await logAudit({ actorId: user.id, actorName: user.name, action: 'PASSWORD_CHANGED', entity: 'Authentication', ip: req.ip });
  res.json({ success: true, message: 'Password changed. Other devices have been signed out.', sessionExpiresAt: session.expiresAt });
});

// Change the sign-in email. Needs the current password; the new address must
// be unused and is re-verified.
router.put('/email', requireAuth, authLimiter, async (req, res) => {
  const parsed = changeEmailSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const { email, currentPassword } = parsed.data;
  const user = await findUserById(req.user.id);
  if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) {
    return res.status(400).json({ success: false, message: 'Your current password is incorrect.' });
  }
  if (email === user.email) return res.status(400).json({ success: false, message: 'That is already your email address.' });
  if (await findUserByEmail(email)) return res.status(409).json(DUPLICATE_MESSAGES.email);
  let updated;
  try {
    updated = await updateUserEmail(user.id, email);
  } catch (err) {
    if (duplicateUserField(err) === 'email') return res.status(409).json(DUPLICATE_MESSAGES.email);
    throw err;
  }
  await sendVerification(updated);
  await logAudit({ actorId: user.id, actorName: user.name, action: 'EMAIL_CHANGED', entity: 'User', entityId: user.id, previousValue: user.email, newValue: email, ip: req.ip });
  res.json({ success: true, user: toSafeUser(updated), message: `Email updated. We sent a verification link to ${email}.` });
});

// -----------------------------------------------------------------------
// Password reset — generic responses to avoid account enumeration.
// -----------------------------------------------------------------------
router.post('/forgot-password', authLimiter, async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  }
  const user = await findUserByEmail(parsed.data.email);

  if (user) {
    const rawToken = generateOpaqueToken();
    await createToken('reset', { userId: user.id, tokenHash: hashOpaqueToken(rawToken), ttlMs: 30 * 60 * 1000 });
    sendPasswordResetEmail(user.email, `${APP_URL}/auth/reset-password?token=${rawToken}`, user.name).catch((e) =>
      console.error('Failed to send password reset email:', e)
    );
    await logAudit({ actorId: user.id, actorName: user.name, action: 'PASSWORD_RESET_REQUESTED', entity: 'Authentication', ip: req.ip });
  }

  // Always the same response, whether or not the email exists.
  res.json({ success: true, message: 'If an account exists for that email, a reset link has been sent.' });
});

router.post('/reset-password', authLimiter, async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  }
  const { token, password } = parsed.data;

  const strength = validatePasswordStrength(password);
  if (!strength.valid) {
    return res.status(400).json({ success: false, message: strength.errors.join('. ') });
  }

  const record = await consumeToken('reset', hashOpaqueToken(token));
  if (!record) {
    return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired.' });
  }

  const passwordHash = await hashPassword(password);
  await updateUserPassword(record.userId, passwordHash);
  // A successful reset proves account ownership via email — clear any
  // brute-force lockout along with it, otherwise a legitimate owner who
  // resets their password stays locked out by the very attempts they
  // were trying to recover from.
  await clearFailedLogins(record.userId);
  // Force re-login everywhere — a leaked-then-reset password shouldn't leave old sessions valid.
  await revokeAllSessionsForUser(record.userId);
  await logAudit({ actorId: record.userId, action: 'PASSWORD_RESET_COMPLETED', entity: 'Authentication', ip: req.ip });

  res.json({ success: true, message: 'Password updated. Please sign in again.' });
});

// -----------------------------------------------------------------------
// Email verification
// -----------------------------------------------------------------------
router.post('/verify-email', async (req, res) => {
  const parsed = verifyEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  }
  const record = await consumeToken('verify', hashOpaqueToken(parsed.data.token));
  if (!record) {
    return res.status(400).json({ success: false, message: 'This verification link is invalid or has expired.' });
  }
  await markEmailVerified(record.userId);
  await qualifyReferral(record.userId);
  res.json({ success: true, message: 'Email verified successfully.' });
});

export default router;
