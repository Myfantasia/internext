// Origin allow-list shared by CORS and the CSRF check.
// APP_URL may hold several comma-separated origins (e.g. the Vercel URL and a custom domain).
export function allowedOrigins() {
  const configured = (process.env.APP_URL || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (configured.length) return configured;
  // Development fallback only — production must set APP_URL.
  return process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5174', 'http://127.0.0.1:5174'];
}

export function corsOptions() {
  const origins = new Set(allowedOrigins());
  return {
    credentials: true,
    origin(origin, callback) {
      // Same-origin and server-to-server requests have no Origin header.
      if (!origin) return callback(null, true);
      return callback(null, origins.has(origin));
    }
  };
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// CSRF defence for cookie-authenticated requests. The session cookie is
// SameSite=Lax (blocks most cross-site POSTs); this additionally rejects
// state-changing browser requests whose Origin/Referer is a foreign site.
// Payment webhooks/callbacks are server-to-server (no Origin) and are
// authenticated by signature / secret path instead.
export function csrfOriginCheck(req, res, next) {
  if (!UNSAFE_METHODS.has(req.method)) return next();
  const origin = req.headers.origin || refererOrigin(req.headers.referer);
  if (!origin) return next();

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const sameHost = host && (origin === `https://${host}` || origin === `http://${host}`);
  if (sameHost || allowedOrigins().includes(origin)) return next();

  return res.status(403).json({ success: false, code: 'CSRF_REJECTED', message: 'Request blocked: unexpected origin.' });
}

function refererOrigin(referer) {
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}
