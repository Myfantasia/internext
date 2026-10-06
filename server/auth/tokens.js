import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be set to a random string of at least 32 characters.');
}

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET);
// Absolute session lifetime. Enforced in three places that must agree: the JWT
// `exp` claim, the sessions.expires_at row (checked on every request), and the
// cookie max-age. Sliding renewal is deliberately NOT done: after 3 hours the
// user must sign in again, however active they were.
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS) > 0 ? Number(process.env.SESSION_TTL_HOURS) : 3;
const SESSION_TTL_SECONDS = Math.round(SESSION_TTL_HOURS * 60 * 60);

// --- Session JWT (identity + role claims, stateless-verifiable) ---------
// The `sid` claim references a row in the `sessions` table so a session can
// be revoked (logout / logout-all-devices) even though the JWT itself is
// self-verifying and not looked up on every request by content.

export async function signSessionToken({ userId, role, sessionId }) {
  return new SignJWT({ role, sid: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(SECRET);
}

export async function verifySessionToken(token) {
  const { payload } = await jwtVerify(token, SECRET, { algorithms: ['HS256'] });
  return { userId: payload.sub, role: payload.role, sessionId: payload.sid };
}

export function sessionCookieMaxAgeMs() {
  return SESSION_TTL_SECONDS * 1000;
}

export function sessionTtlSeconds() {
  return SESSION_TTL_SECONDS;
}

// --- Opaque single-use tokens (email verification / password reset / invites) ---
// The raw token is sent to the user (email link); only its SHA-256 hash is
// stored, so a DB read alone never yields a usable token.

export function generateOpaqueToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashOpaqueToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
