// Session-expiry plumbing shared by the whole SPA.
//
// The server is the authority: when a request carries an expired/revoked
// session it answers with the `X-Session-Expired: 1` header (and 401
// SESSION_EXPIRED on protected endpoints). We watch every fetch response for
// that header and broadcast one app-wide event so AuthContext can sign the
// user out and send them to the login page.

export const SESSION_EXPIRED_EVENT = 'auth:session-expired';

let installed = false;

export function installSessionExpiryInterceptor() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const response = await originalFetch(...args);
    if (response.headers.get('X-Session-Expired') === '1') {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    return response;
  };
}

// Only same-site relative paths are accepted as post-login destinations
// (blocks "//evil.com", "/\\evil.com" and absolute URLs — open-redirect defence).
export function safeReturnPath(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  if (/^\/(auth|login|register|admin\/login|admin\/signup)(\/|\?|$)/i.test(raw)) return fallback;
  return raw;
}

export function currentPathWithQuery() {
  return window.location.pathname + window.location.search;
}
