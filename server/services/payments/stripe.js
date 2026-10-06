import Stripe from 'stripe';

// Stripe Checkout (Stripe-hosted payment page). Card numbers and CVV are
// entered on Stripe's page and never reach this server — keeps PCI scope at
// the lightest level (SAQ A).

let client = null;

export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    const err = new Error('Card payments are not configured (STRIPE_SECRET_KEY is missing).');
    err.code = 'STRIPE_NOT_CONFIGURED';
    throw err;
  }
  if (process.env.NODE_ENV === 'production' && key.startsWith('sk_test_')) {
    console.warn('[stripe] A TEST secret key is configured while NODE_ENV=production.');
  }
  client ??= new Stripe(key, { maxNetworkRetries: 2, timeout: 20000 });
  return client;
}

export function stripeCurrency() {
  return (process.env.STRIPE_CURRENCY || 'kes').toLowerCase();
}

// Stripe amounts are in the currency's minor unit. KES is a two-decimal
// currency in Stripe, so KES 1,250 = 125000.
const ZERO_DECIMAL = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);
export function toMinorUnits(amount, currency = stripeCurrency()) {
  return ZERO_DECIMAL.has(currency) ? Math.round(Number(amount)) : Math.round(Number(amount) * 100);
}

export function fromMinorUnits(amount, currency = stripeCurrency()) {
  return ZERO_DECIMAL.has(String(currency).toLowerCase()) ? Number(amount) : Number(amount) / 100;
}

export async function createCheckoutSession({ order, attemptId, appUrl }) {
  const stripe = stripeClient();
  const currency = stripeCurrency();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: order.customer.email,
    client_reference_id: order.id,
    line_items: [{
      quantity: 1,
      price_data: {
        currency,
        unit_amount: toMinorUnits(order.total, currency),
        product_data: {
          name: `Order ${order.orderNumber}`,
          description: `${order.items.length} item(s) incl. delivery and VAT — Internext Business System`
        }
      }
    }],
    metadata: { orderId: order.id, orderNumber: order.orderNumber, attemptId },
    payment_intent_data: { metadata: { orderId: order.id, orderNumber: order.orderNumber, attemptId } },
    success_url: `${appUrl}/order-confirmation?orderNumber=${encodeURIComponent(order.orderNumber)}&payment=card&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/order-confirmation?orderNumber=${encodeURIComponent(order.orderNumber)}&payment=card&cancelled=1`,
    // Stripe's minimum is 30 minutes.
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60
  }, { idempotencyKey: `checkout-${attemptId}` });
  return { sessionId: session.id, url: session.url, raw: { id: session.id, amount_total: session.amount_total, currency: session.currency } };
}

export async function retrieveCheckoutSession(sessionId) {
  return stripeClient().checkout.sessions.retrieve(sessionId);
}

// Throws if the signature does not match — callers answer 400.
export function verifyWebhook(rawBody, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    const err = new Error('STRIPE_WEBHOOK_SECRET is not configured.');
    err.code = 'STRIPE_NOT_CONFIGURED';
    throw err;
  }
  return stripeClient().webhooks.constructEvent(rawBody, signature, secret);
}

// Maps a Checkout Session to our attempt status.
export function sessionOutcome(session) {
  if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') return 'succeeded';
  if (session.status === 'expired') return 'cancelled';
  return 'pending';
}

export async function refundPayment(paymentIntentId, amount) {
  return stripeClient().refunds.create({
    payment_intent: paymentIntentId,
    ...(amount != null ? { amount: toMinorUnits(amount) } : {})
  });
}
