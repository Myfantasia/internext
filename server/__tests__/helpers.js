// Shared test helpers. Tests run against the real database configured in .env.

export function extractCookie(res) {
  const raw = res.headers['set-cookie'];
  return Array.isArray(raw) ? raw.map((c) => c.split(';')[0]).filter((c) => !c.endsWith('=')).join('; ') : undefined;
}

export const TEST_LOCATION = { county: 'Nairobi', town: 'Westlands', addressLine: 'Test Street', lat: -1.2676, lng: 36.8108, source: 'map' };

// Phone numbers are unique per account, so every test user needs its own.
export function uniqueKenyanPhone() {
  return `07${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
}

// Registration no longer signs the user in, so tests register then log in.
export async function registerAndLogin(request, app, user) {
  const reg = await request(app).post('/api/auth/register').send({ phone: uniqueKenyanPhone(), location: TEST_LOCATION, ...user });
  const login = await request(app).post('/api/auth/login').send({ email: user.email, password: user.password });
  return { reg, login, cookie: extractCookie(login) };
}
