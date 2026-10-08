import { describe, it, expect, beforeAll } from 'vitest';

// Prevent server/index.js from calling app.listen() — supertest spins up its
// own ephemeral listener per request against the exported app.
process.env.VERCEL = '1';

const { default: request } = await import('supertest');
const { default: app } = await import('../index.js');
const { extractCookie: cookieFrom, TEST_LOCATION, uniqueKenyanPhone } = await import('./helpers.js');

const suffix = Date.now();
const admin = { email: `test-admin-${suffix}@internextbusinesssystem.co.ke`, password: 'AdminPass123', name: 'Test Admin' };
const customer = { email: `test-customer-${suffix}@example.com`, password: 'StrongPass1', name: 'Test Customer' };

let adminCookie;
let customerCookie;

const extractCookie = cookieFrom;

describe('Authentication', () => {
  it('registers a customer and never allows a client-supplied role to take effect', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...customer, phone: uniqueKenyanPhone(), location: TEST_LOCATION, role: 'ADMIN' }); // attempted privilege escalation via extra field

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('CUSTOMER');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('does not sign the user in on registration — a separate login is required', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'No Auto Login', email: `noauto-${suffix}@example.com`, password: 'StrongPass1', phone: uniqueKenyanPhone(), location: TEST_LOCATION });
    expect(res.status).toBe(201);
    expect(res.body.requiresLogin).toBe(true);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('requires a valid county and Kenyan phone at registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bad Location', email: `badloc-${suffix}@example.com`, password: 'StrongPass1', phone: '123', location: { county: 'Atlantis', town: 'X' } });
    expect(res.status).toBe(400);
  });

  it('rejects weak passwords server-side', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'X', email: `weak-${suffix}@example.com`, password: 'weak' });
    expect(res.status).toBe(400);
  });

  it('rejects the historical exploit: login with an arbitrary role in the body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: customer.email, password: customer.password, role: 'super_admin' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('CUSTOMER');
    customerCookie = extractCookie(res);
  });

  it('refuses a customer account on the staff portal without opening a session', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: customer.email, password: customer.password, portal: 'staff' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('USE_STORE_SIGNIN');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('rejects a second account with an already-registered phone number', async () => {
    const phone = uniqueKenyanPhone();
    const first = await request(app).post('/api/auth/register')
      .send({ name: 'Phone One', email: `phone1-${suffix}@example.com`, password: 'StrongPass1', phone, location: TEST_LOCATION });
    expect(first.status).toBe(201);
    // Same number written differently still clashes (stored normalized).
    const second = await request(app).post('/api/auth/register')
      .send({ name: 'Phone Two', email: `phone2-${suffix}@example.com`, password: 'StrongPass1', phone: `+254 ${phone.slice(1)}`, location: TEST_LOCATION });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('PHONE_TAKEN');
  });

  it('issues a session that expires in 3 hours (server-side and cookie)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: customer.email, password: customer.password });
    const ttlMs = new Date(res.body.sessionExpiresAt).getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(2.9 * 3600 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(3 * 3600 * 1000 + 5000);
    const cookie = res.headers['set-cookie'].find((c) => c.includes('Max-Age='));
    expect(Number(cookie.match(/Max-Age=(\d+)/)[1])).toBe(3 * 3600);
  });

  it('rejects a session whose server-side row has expired, with SESSION_EXPIRED', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: customer.email, password: customer.password });
    const cookie = extractCookie(login);
    const { db } = await import('../db/client.js');
    const { sessions } = await import('../db/schema.js');
    const { eq } = await import('drizzle-orm');
    const { verifySessionToken } = await import('../auth/tokens.js');
    const { sessionId } = await verifySessionToken(cookie.split('=').slice(1).join('='));
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.id, sessionId));

    const res = await request(app).get('/api/cart').set('Cookie', cookie);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SESSION_EXPIRED');
    expect(res.headers['x-session-expired']).toBe('1');
  });

  it('logout invalidates the session server-side', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: customer.email, password: customer.password });
    const cookie = extractCookie(login);
    await request(app).post('/api/auth/logout').set('Cookie', cookie);
    const res = await request(app).get('/api/cart').set('Cookie', cookie);
    expect(res.status).toBe(401);
  });

  it('rejects invalid credentials with a generic message (no user enumeration)', async () => {
    const known = await request(app).post('/api/auth/login').send({ email: customer.email, password: 'WrongPassword1' });
    const unknown = await request(app).post('/api/auth/login').send({ email: `nobody-${suffix}@example.com`, password: 'WrongPassword1' });
    expect(known.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(known.body.message).toBe(unknown.body.message);
  });
});

describe('RBAC — backend enforcement (not just UI hiding)', () => {
  beforeAll(async () => {
    // Bootstrap-equivalent: insert an ADMIN directly via the repository used
    // by the CLI script, since admin creation must never be an HTTP endpoint.
    const { hashPassword } = await import('../auth/passwords.js');
    const { createUser, findUserByEmail } = await import('../repositories/usersRepo.js');
    const existing = await findUserByEmail(admin.email);
    if (!existing) {
      const passwordHash = await hashPassword(admin.password);
      await createUser({ name: admin.name, email: admin.email, passwordHash, role: 'ADMIN' });
    }
    const res = await request(app).post('/api/auth/login').send({ email: admin.email, password: admin.password, portal: 'staff' });
    adminCookie = extractCookie(res);
  });

  it('refuses staff accounts on the customer sign-in', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: admin.email, password: admin.password });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('USE_STAFF_PORTAL');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('blocks unauthenticated access to admin endpoints', async () => {
    const res = await request(app).get('/api/admin/analytics');
    expect(res.status).toBe(401);
  });

  it('blocks a CUSTOMER from admin endpoints', async () => {
    const res = await request(app).get('/api/admin/analytics').set('Cookie', customerCookie);
    expect(res.status).toBe(403);
  });

  it('allows ADMIN access to admin endpoints', async () => {
    const res = await request(app).get('/api/admin/analytics').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
  });

  it('blocks a CUSTOMER from creating products', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', customerCookie)
      .send({ name: 'Should Not Exist', price: 100, stock: 1, sku: `x-${suffix}` });
    expect(res.status).toBe(403);
  });

  it('never exposes M-Pesa secrets on the public settings endpoint', async () => {
    const res = await request(app).get('/api/admin/settings/public');
    expect(res.status).toBe(200);
    expect(res.body.settings.mpesaConsumerKey).toBeUndefined();
    expect(res.body.settings.mpesaConsumerSecret).toBeUndefined();
    expect(res.body.settings.mpesaPasskey).toBeUndefined();
  });

  it('keeps customer profiles, finance figures and the admin product list staff-only', async () => {
    for (const path of ['/api/admin/customers', '/api/admin/finance/overview', '/api/admin/expenses', '/api/products/admin']) {
      const res = await request(app).get(path).set('Cookie', customerCookie);
      expect(res.status, path).toBe(403);
    }
    const deactivate = await request(app).patch('/api/admin/customers/00000000-0000-4000-8000-000000000000/status').set('Cookie', customerCookie).send({ isActive: false });
    expect(deactivate.status).toBe(403);
  });

  it('serves paginated customers, finance and admin products to an ADMIN', async () => {
    const customers = await request(app).get('/api/admin/customers?limit=5&sort=spent').set('Cookie', adminCookie);
    expect(customers.status).toBe(200);
    expect(customers.body.limit).toBe(5);
    expect(customers.body.customers.length).toBeLessThanOrEqual(5);
    const finance = await request(app).get('/api/admin/finance/overview?from=2026-01-01&to=2026-12-31').set('Cookie', adminCookie);
    expect(finance.status).toBe(200);
    expect(finance.body.current).toHaveProperty('netProfit');
    expect(Array.isArray(finance.body.series)).toBe(true);
    const orders = await request(app).get('/api/orders?limit=5&sort=total-desc').set('Cookie', adminCookie);
    expect(orders.status).toBe(200);
    expect(orders.body.orders.length).toBeLessThanOrEqual(5);
    expect(orders.body).toHaveProperty('statusCounts');
    const products = await request(app).get('/api/products/admin?limit=5&stock=low').set('Cookie', adminCookie);
    expect(products.status).toBe(200);
    expect(products.body).toHaveProperty('counts');
  });

  it('records an expense, counts it in the period, and validates bad input', async () => {
    const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
    const future = await request(app).post('/api/admin/expenses').set('Cookie', adminCookie)
      .send({ spentOn: '2999-01-01', category: 'Rent', description: 'Future', amount: 100 });
    expect(future.status).toBe(400);
    const zero = await request(app).post('/api/admin/expenses').set('Cookie', adminCookie)
      .send({ spentOn: day, category: 'Rent', description: 'Zero', amount: 0 });
    expect(zero.status).toBe(400);

    const before = await request(app).get(`/api/admin/finance/overview?from=${day}&to=${day}`).set('Cookie', adminCookie);
    const created = await request(app).post('/api/admin/expenses').set('Cookie', adminCookie)
      .send({ spentOn: day, category: 'Utilities', description: `Test power bill ${suffix}`, amount: 1234.5 });
    expect(created.status).toBe(201);
    const after = await request(app).get(`/api/admin/finance/overview?from=${day}&to=${day}`).set('Cookie', adminCookie);
    expect(after.body.current.expenses).toBeCloseTo(before.body.current.expenses + 1234.5, 2);

    const removed = await request(app).delete(`/api/admin/expenses/${created.body.expense.id}`).set('Cookie', adminCookie);
    expect(removed.status).toBe(200);
  });

  // Regression: POST /api/flash-deals used to 500 — the overlap check passed a
  // raw Date into a sql`` fragment, which the postgres-js driver rejects.
  it('creates a flash deal, refuses an overlapping one with a clear message, then archives it', async () => {
    const list = await request(app).get('/api/products?limit=1');
    const product = list.body.products?.[0];
    expect(product).toBeTruthy();
    const startsAt = new Date(Date.now() + 365 * 86400000).toISOString();
    const endsAt = new Date(Date.now() + 366 * 86400000).toISOString();
    const body = { productId: product.id, title: `Test deal ${suffix}`, discountType: 'percentage', discountValue: 5, startsAt, endsAt, isActive: true };

    const created = await request(app).post('/api/flash-deals').set('Cookie', adminCookie).send(body);
    expect(created.status).toBe(201);
    const overlap = await request(app).post('/api/flash-deals').set('Cookie', adminCookie).send({ ...body, title: `Overlap ${suffix}` });
    expect(overlap.status).toBe(400);
    expect(overlap.body.message).toMatch(/already covers this product/);
    const badPercent = await request(app).post('/api/flash-deals').set('Cookie', adminCookie).send({ ...body, discountValue: 150 });
    expect(badPercent.status).toBe(400);

    const archived = await request(app).delete(`/api/flash-deals/${created.body.deal.id}`).set('Cookie', adminCookie);
    expect(archived.status).toBe(200);
  });

  it('blocks a CUSTOMER from creating a sales-manager invite', async () => {
    const res = await request(app)
      .post('/api/admin/invites')
      .set('Cookie', customerCookie)
      .send({ email: `nobody-${suffix}@example.com` });
    expect(res.status).toBe(403);
  });
});

describe('IDOR protections', () => {
  it('scopes /api/orders/customer/:query to the authenticated customer regardless of the URL param', async () => {
    const res = await request(app)
      .get('/api/orders/customer/someone-elses-email@example.com')
      .set('Cookie', customerCookie);
    expect(res.status).toBe(200);
    // Every returned order (if any) must belong to this customer, never "someone else's".
    for (const order of res.body.orders) {
      expect(order.customer.email.toLowerCase()).toBe(customer.email.toLowerCase());
    }
  });

  it('redacts customer PII on the public order-tracking endpoint for non-owners', async () => {
    const res = await request(app).get('/api/orders/ORD-2026-000101');
    if (res.status === 200) {
      expect(res.body.order.customer).toBeUndefined();
      expect(res.body.order.total).toBeUndefined();
    }
  });

  it('removed the old endpoint that let any signed-in user mark an order as paid', async () => {
    const res = await request(app).post('/api/orders/ORD-2026-000101/mpesa-verify').set('Cookie', customerCookie).send({});
    expect(res.status).toBe(404);
  });

  it('does not let a customer start payment for an order that is not theirs', async () => {
    const res = await request(app).post('/api/payments/orders/00000000-0000-4000-8000-000000000000/start').set('Cookie', customerCookie).send({ provider: 'mpesa', phone: '0712345678' });
    expect(res.status).toBe(404);
  });

  it('rejects M-Pesa callbacks without the secret path token', async () => {
    const res = await request(app).post('/api/payments/mpesa/callback/wrong-secret').send({ Body: { stkCallback: { CheckoutRequestID: 'x', ResultCode: 0 } } });
    expect(res.status).toBe(404);
  });

  it('rejects Stripe webhooks with an invalid signature', async () => {
    const res = await request(app).post('/api/payments/stripe/webhook').set('Content-Type', 'application/json').set('Stripe-Signature', 't=1,v1=bad').send('{}');
    expect([400, 500]).toContain(res.status);
  });

  it('rejects cross-site state-changing requests (CSRF origin check)', async () => {
    const res = await request(app).post('/api/auth/logout').set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
  });

  it('does not crash the API on a blog slug lookup that misses', async () => {
    const res = await request(app).get('/api/blog/definitely-not-a-real-post');
    expect(res.status).toBe(404);
  });

  it('blocks unauthenticated access to the full support ticket list', async () => {
    const res = await request(app).get('/api/tickets');
    expect(res.status).toBe(401);
  });
});
