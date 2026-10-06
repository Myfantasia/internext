import { can } from '../auth/permissions.js';

// Real security boundary. attachUser (server/middleware/session.js) must run
// first on every request; these middlewares decide whether the request is
// allowed to proceed. Frontend route guards are UX only and are not trusted.

function unauthenticated(req, res) {
  if (req.sessionExpired) {
    return res.status(401).json({
      success: false,
      code: 'SESSION_EXPIRED',
      message: 'Your session has expired. Please sign in again.'
    });
  }
  return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Authentication required' });
}

export function requireAuth(req, res, next) {
  if (!req.user) return unauthenticated(req, res);
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return unauthenticated(req, res);
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'You do not have permission to perform this action' });
    }
    next();
  };
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return unauthenticated(req, res);
    if (!can(req.user.role, permission)) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'You do not have permission to perform this action' });
    }
    next();
  };
}
