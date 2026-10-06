import { verifySessionToken } from '../auth/tokens.js';
import { getActiveSession } from '../repositories/sessionsRepo.js';
import { findUserById } from '../repositories/usersRepo.js';

const COOKIE_NAME = process.env.COOKIE_NAME || 'ibs_session';

export function getCookieName() {
  return COOKIE_NAME;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/'
  };
}

// Attaches req.user (or leaves it undefined) — never throws. Actual
// authentication/authorization enforcement happens in requireAuth /
// requireRole / requirePermission (server/middleware/authorize.js).
//
// When a cookie is present but no longer valid (JWT expired, session row
// expired/revoked, user deactivated) the cookie is cleared and
// req.sessionExpired is set, so guards can answer with SESSION_EXPIRED and the
// X-Session-Expired header tells the SPA to send the user back to sign-in.
export async function attachUser(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();

  try {
    const { userId, sessionId } = await verifySessionToken(token);

    const session = await getActiveSession(sessionId);
    if (!session || session.userId !== userId) return markExpired(req, res, next);

    const user = await findUserById(userId);
    if (!user || !user.isActive) return markExpired(req, res, next);

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      // Email-based access (guest orders/tickets) requires a verified address.
      emailVerified: !!user.emailVerifiedAt,
      role: user.role,
      sessionId,
      sessionExpiresAt: session.expiresAt
    };
    return next();
  } catch (err) {
    // jose throws for a bad signature or an expired `exp`; anything else (DB
    // outage) must not be reported to the user as "your session expired".
    if (err?.code?.startsWith?.('ERR_JW')) return markExpired(req, res, next);
    return next(err);
  }
}

function markExpired(req, res, next) {
  req.sessionExpired = true;
  res.clearCookie(COOKIE_NAME, sessionCookieOptions());
  res.setHeader('X-Session-Expired', '1');
  return next();
}
