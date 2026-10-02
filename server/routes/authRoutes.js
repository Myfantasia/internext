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
  formatZodError
} from '../schemas/authSchemas.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../auth/passwords.js';
import { signSessionToken, verifySessionToken, generateOpaqueToken, hashOpaqueToken, sessionCookieMaxAgeMs } from '../auth/tokens.js';
import {
  findUserByEmail,
  findUserById,
  createUser,
  createFirstAdminIfAbsent,
  findUserByReferralCode,
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
import { getCookieName } from '../middleware/session.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email/index.js';
import { PERMISSIONS } from '../auth/permissions.js';
import { registerWithStaffCode } from '../repositories/staffSignupCodesRepo.js';
import { getReferralSummary, issueReferralRewards } from '../repositories/referralRepo.js';

const router = express.Router();
const COOKIE_NAME = getCookieName();
const APP_URL = process.env.APP_URL || 'http://localhost:5174';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' }
});
const staffSignupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many staff signup attempts. Try again later.' }
});

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    maxAge: sessionCookieMaxAgeMs(),
    path: '/'
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

async function establishSession(req, res, user) {
  const session = await createSession({
    userId: user.id,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });
  const token = await signSessionToken({ userId: user.id, role: user.role, sessionId: session.id });
  setSessionCookie(res, token);
}

// -----------------------------------------------------------------------
// Registration — always CUSTOMER. Role is never accepted from the client.
// -----------------------------------------------------------------------
router.post('/register', authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  }
  const { name, email, phone, password, referralCode } = parsed.data;

  const strength = validatePasswordStrength(password);
  if (!strength.valid) {
    return res.status(400).json({ success: false, message: strength.errors.join('. ') });
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    // Generic message — do not reveal which part of the input was wrong.
    return res.status(400).json({ success: false, message: 'Unable to register with the provided details' });
  }

  let referredBy = null;
  if (referralCode) {
    const referrer = await findUserByReferralCode(referralCode);
    if (!referrer) return res.status(400).json({ success: false, message: 'That referral code is invalid.' });
    referredBy = referrer.id;
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser({ name, email, phone, passwordHash, role: 'CUSTOMER', referredBy });

  const rawToken = generateOpaqueToken();
  await createToken('verify', { userId: user.id, tokenHash: hashOpaqueToken(rawToken), ttlMs: 24 * 60 * 60 * 1000 });
  sendVerificationEmail(user.email, `${APP_URL}/auth/verify-email?token=${rawToken}`).catch((e) =>
    console.error('Failed to send verification email:', e)
  );

  await establishSession(req, res, user);
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    action: 'USER_REGISTER',
    entity: 'User',
    entityId: user.id,
    newValue: 'CUSTOMER account created',
    ip: req.ip
  });

  res.status(201).json({ success: true, user: toSafeUser(user), permissions: PERMISSIONS[user.role] });
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
  const { name, email, phone, password, invitationCode, referralCode } = parsed.data;
  const strength = validatePasswordStrength(password);
  if (!strength.valid) return res.status(400).json({ success: false, message: strength.errors.join('. ') });
  if (await findUserByEmail(email)) return res.status(400).json({ success: false, message: 'An account already exists for this email.' });

  let referredBy = null;
  if (referralCode) {
    const referrer = await findUserByReferralCode(referralCode);
    if (!referrer) return res.status(400).json({ success: false, message: 'That referral code is invalid.' });
    referredBy = referrer.id;
  }

  const passwordHash = await hashPassword(password);
  let user;
  if (invitationCode) {
    const result = await registerWithStaffCode({
      codeHash: hashOpaqueToken(invitationCode), name, email, phone, passwordHash, referredBy
    });
    if (result.error === 'existing_user') return res.status(400).json({ success: false, message: 'An account already exists for this email.' });
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
    user = await createFirstAdminIfAbsent({ name, email, phone, passwordHash, referredBy });
    if (!user) return res.status(403).json({ success: false, message: 'The first administrator has already registered. Ask an administrator for a staff signup code.' });
  }

  const rawToken = generateOpaqueToken();
  await createToken('verify', { userId: user.id, tokenHash: hashOpaqueToken(rawToken), ttlMs: 24 * 60 * 60 * 1000 });
  sendVerificationEmail(user.email, `${APP_URL}/auth/verify-email?token=${rawToken}`).catch((e) =>
    console.error('Failed to send staff verification email:', e)
  );
  await establishSession(req, res, user);
  await logAudit({ actorId: user.id, actorName: user.name, action: 'STAFF_REGISTER', entity: 'User', entityId: user.id, newValue: user.role, ip: req.ip });
  res.status(201).json({ success: true, user: toSafeUser(user), permissions: PERMISSIONS[user.role] });
});

router.get('/referrals', requireAuth, async (req, res) => {
  res.json({ success: true, ...(await getReferralSummary(req.user.id)) });
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
  const { email, password } = parsed.data;
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

  await clearFailedLogins(user.id);
  await recordLoginAttempt({ email, ip: req.ip, success: true });
  await establishSession(req, res, user);
  await logAudit({ actorId: user.id, actorName: user.name, action: 'LOGIN_SUCCESS', entity: 'Authentication', ip: req.ip });

  res.json({ success: true, user: toSafeUser(user), permissions: PERMISSIONS[user.role] });
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
  if (!req.user) {
    return res.json({ success: true, user: null, permissions: [] });
  }
  const user = await findUserById(req.user.id);
  res.json({ success: true, user: toSafeUser(user), permissions: PERMISSIONS[req.user.role] || [] });
});

router.put('/profile', requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  }
  const updated = await updateUserProfile(req.user.id, parsed.data);
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'PROFILE_UPDATE', entity: 'User', entityId: req.user.id, ip: req.ip });
  res.json({ success: true, user: toSafeUser(updated) });
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
    sendPasswordResetEmail(user.email, `${APP_URL}/auth/reset-password?token=${rawToken}`).catch((e) =>
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
  const verifiedUser = await findUserById(record.userId);
  if (verifiedUser?.referredBy) {
    await issueReferralRewards(verifiedUser.referredBy);
  }
  res.json({ success: true, message: 'Email verified successfully.' });
});

export default router;
