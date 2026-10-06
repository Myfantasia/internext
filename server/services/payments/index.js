import { and, desc, eq, gt } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { paymentAttempts, paymentEvents } from '../../db/schema.js';
import { confirmOrderPayment, markOrderPaymentFailed, findOrderByIdentifier, OrderError } from '../../repositories/ordersRepo.js';
import { getProductById } from '../../repositories/catalogRepo.js';
import { getCompanyProfile } from '../../repositories/companyProfileRepo.js';
import { logAudit } from '../../repositories/auditLogsRepo.js';
import { sendPaymentConfirmationEmail, sendLowStockAlertEmail } from '../email/index.js';
import { receiptPdfBuffer } from '../documentService.js';
import { maskPhone } from '../location.js';
import * as mpesa from './mpesa.js';
import * as stripe from './stripe.js';

// Provider-neutral payment flow:
//   startPayment  -> creates a payment_attempts row, asks the provider to begin
//   provider calls back (webhook/callback) or we poll -> settleAttempt
//   settleAttempt -> idempotent; on success confirms the order exactly once.
// Order state is only ever changed from a verified provider result.

export class PaymentError extends Error {
  constructor(message, status = 400, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const PROVIDERS = {
  mpesa: { label: 'M-Pesa', paymentMethodLabel: 'M-Pesa STK Push' },
  stripe: { label: 'Card (Stripe)', paymentMethodLabel: 'Card (Visa / Mastercard)' }
};
// Payments confirmed by a person rather than a provider callback: bank
// transfers verified against the statement, and money collected on delivery.
// They go through the same attempt -> settleAttempt path as online payments.
export const OFFLINE_PROVIDERS = {
  bank_transfer: { label: 'Bank Transfer' },
  cash_on_delivery: { label: 'Pay on Delivery' }
};
const providerLabel = (provider) => (PROVIDERS[provider] || OFFLINE_PROVIDERS[provider])?.label || provider;

const appUrl = () => (process.env.APP_URL || 'http://localhost:5174').split(',')[0].trim().replace(/\/$/, '');

// Returns true when the event should be processed: the first delivery, or a
// redelivery of one whose earlier processing never finished.
export async function recordEvent(provider, eventId, type, payload) {
  const [row] = await db.insert(paymentEvents).values({ provider, eventId: String(eventId), type, payload })
    .onConflictDoNothing().returning({ id: paymentEvents.id });
  if (row) return true;
  const [existing] = await db.select({ processedAt: paymentEvents.processedAt }).from(paymentEvents)
    .where(and(eq(paymentEvents.provider, provider), eq(paymentEvents.eventId, String(eventId)))).limit(1);
  return !existing?.processedAt;
}

export async function markEventProcessed(provider, eventId) {
  await db.update(paymentEvents).set({ processedAt: new Date() })
    .where(and(eq(paymentEvents.provider, provider), eq(paymentEvents.eventId, String(eventId))));
}

function toApiAttempt(a) {
  if (!a) return null;
  return {
    id: a.id, provider: a.provider, status: a.status, amount: Number(a.amount), currency: a.currency,
    reference: a.providerReference, payerHint: a.payerHint, failureReason: a.failureReason,
    createdAt: a.createdAt, completedAt: a.completedAt
  };
}

export async function latestAttempt(orderId) {
  const [row] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.orderId, orderId))
    .orderBy(desc(paymentAttempts.createdAt)).limit(1);
  return row || null;
}

export async function startPayment({ order, provider, user, phone }) {
  if (!PROVIDERS[provider]) throw new PaymentError('Unsupported payment method.');
  if (order.paymentStatus === 'Paid') throw new PaymentError('This order has already been paid.', 409, 'ALREADY_PAID');
  if (order.status === 'Cancelled') throw new PaymentError('This order was cancelled. Please place a new order.', 409, 'ORDER_CANCELLED');

  // Don't fire a second STK prompt / checkout while one is still live.
  const recentWindow = provider === 'mpesa' ? 90 * 1000 : 25 * 60 * 1000;
  const [inFlight] = await db.select().from(paymentAttempts).where(and(
    eq(paymentAttempts.orderId, order.id), eq(paymentAttempts.provider, provider), eq(paymentAttempts.status, 'pending'),
    gt(paymentAttempts.createdAt, new Date(Date.now() - recentWindow))
  )).orderBy(desc(paymentAttempts.createdAt)).limit(1);
  if (inFlight) {
    if (provider === 'stripe' && inFlight.rawResponse?.url) return { attempt: toApiAttempt(inFlight), redirectUrl: inFlight.rawResponse.url, reused: true };
    if (provider === 'mpesa') throw new PaymentError('An M-Pesa prompt was just sent for this order. Check your phone, or wait a minute before trying again.', 429, 'PAYMENT_IN_PROGRESS');
  }

  const [attempt] = await db.insert(paymentAttempts).values({
    orderId: order.id,
    userId: user.id,
    provider,
    amount: String(order.total),
    currency: order.currency || 'KES',
    payerHint: provider === 'mpesa' ? maskPhone(phone) : null
  }).returning();

  try {
    if (provider === 'mpesa') {
      const result = await mpesa.initiateStkPush({
        phone,
        amount: order.total,
        accountReference: order.orderNumber.replace(/^ORD-/, ''),
        description: 'Order payment'
      });
      const [updated] = await db.update(paymentAttempts)
        .set({ providerSessionId: result.sessionId, rawResponse: result.raw, updatedAt: new Date() })
        .where(eq(paymentAttempts.id, attempt.id)).returning();
      return { attempt: toApiAttempt(updated), customerMessage: result.customerMessage, simulated: mpesa.mpesaEnv() === 'simulation' };
    }

    const session = await stripe.createCheckoutSession({ order, attemptId: attempt.id, appUrl: appUrl() });
    const [updated] = await db.update(paymentAttempts)
      .set({ providerSessionId: session.sessionId, rawResponse: { ...session.raw, url: session.url }, updatedAt: new Date() })
      .where(eq(paymentAttempts.id, attempt.id)).returning();
    return { attempt: toApiAttempt(updated), redirectUrl: session.url };
  } catch (err) {
    await db.update(paymentAttempts)
      .set({ status: 'failed', failureReason: String(err.message).slice(0, 300), rawResponse: err.raw || null, completedAt: new Date(), updatedAt: new Date() })
      .where(eq(paymentAttempts.id, attempt.id));
    if (err.code === 'MPESA_NOT_CONFIGURED' || err.code === 'STRIPE_NOT_CONFIGURED') {
      console.error(`[payments] ${err.message}`);
      throw new PaymentError('This payment method is temporarily unavailable. Please choose another method or contact us.', 503, err.code);
    }
    console.error('[payments] start failed:', err);
    throw new PaymentError(provider === 'mpesa' ? 'We could not send the M-Pesa prompt. Check the phone number and try again.' : 'We could not open the card payment page. Please try again.', 502, 'PROVIDER_ERROR');
  }
}

// The one place a provider result changes our state. Idempotent: the attempt
// row is locked, and only a still-pending attempt is settled.
export async function settleAttempt({ provider, sessionId, attemptId, outcome, reference, amount, reason, raw, actor }) {
  const settled = await db.transaction(async (tx) => {
    const where = attemptId ? eq(paymentAttempts.id, attemptId) : and(eq(paymentAttempts.provider, provider), eq(paymentAttempts.providerSessionId, sessionId));
    const [attempt] = await tx.select().from(paymentAttempts).where(where).limit(1).for('update');
    if (!attempt) return { found: false };
    if (attempt.status !== 'pending') return { found: true, attempt, changed: false };

    const [updated] = await tx.update(paymentAttempts).set({
      status: outcome,
      providerReference: reference || attempt.providerReference,
      failureReason: outcome === 'succeeded' ? null : (reason ? String(reason).slice(0, 300) : null),
      rawResponse: raw ?? attempt.rawResponse,
      completedAt: new Date(),
      updatedAt: new Date()
    }).where(eq(paymentAttempts.id, attempt.id)).returning();
    return { found: true, attempt: updated, changed: true };
  });

  if (!settled.found || !settled.changed) return settled;
  const attempt = settled.attempt;

  if (outcome === 'succeeded') {
    try {
      const result = await confirmOrderPayment(attempt.orderId, {
        provider: providerLabel(provider),
        paymentReference: reference,
        amount: amount ?? Number(attempt.amount),
        rawPayload: raw ? { provider, reference, attemptId: attempt.id } : null,
        changedByUserId: actor?.id
      });
      if (result && !result.alreadyPaid) {
        await logAudit({
          actorId: actor?.id || null, actorName: actor?.name || result.order.customer.name, action: 'PAYMENT_CONFIRMED', entity: 'Order',
          entityId: result.order.id, previousValue: 'Pending', newValue: `Paid via ${providerLabel(provider)} (${reference || 'n/a'})`
        });
        emailReceipt(result.order, result.receipt).catch((e) => console.error('Failed to send payment confirmation email:', e));
        checkAndAlertLowStock(result.order).catch((e) => console.error('Failed to check/send low-stock alert:', e));
      }
    } catch (err) {
      if (err instanceof OrderError && err.code === 'AMOUNT_MISMATCH') {
        await db.update(paymentAttempts).set({ status: 'failed', failureReason: err.message, updatedAt: new Date() }).where(eq(paymentAttempts.id, attempt.id));
        await logAudit({ action: 'PAYMENT_AMOUNT_MISMATCH', entity: 'Order', entityId: attempt.orderId, newValue: err.message });
        return { ...settled, changed: true, mismatch: true };
      }
      // Put the attempt back to pending so the next webhook redelivery or
      // status poll retries the confirmation instead of losing it.
      await db.update(paymentAttempts).set({ status: 'pending', completedAt: null, updatedAt: new Date() }).where(eq(paymentAttempts.id, attempt.id));
      throw err;
    }
  } else if (outcome === 'failed' || outcome === 'cancelled') {
    await markOrderPaymentFailed(attempt.orderId, { status: outcome, reason });
  }
  return { ...settled, order: await findOrderByIdentifier(attempt.orderId) };
}

// Polled by the checkout while waiting. Asks the provider directly if the
// callback/webhook hasn't arrived — useful locally where Safaricom/Stripe
// can't reach the dev machine. Throttled per attempt.
const lastChecked = new Map();
export async function refreshAttempt(attempt) {
  if (!attempt || attempt.status !== 'pending' || !attempt.providerSessionId) return attempt;
  const last = lastChecked.get(attempt.id) || 0;
  if (Date.now() - last < 4000) return attempt;
  lastChecked.set(attempt.id, Date.now());

  try {
    if (attempt.provider === 'mpesa') {
      // Give the customer time to enter their PIN before querying.
      if (mpesa.mpesaEnv() !== 'simulation' && Date.now() - new Date(attempt.createdAt).getTime() < 15000) return attempt;
      const q = await mpesa.queryStkStatus(attempt.providerSessionId);
      if (q.state === 'pending') {
        // Daraja prompts expire after about a minute; past 3 minutes treat as timed out.
        if (Date.now() - new Date(attempt.createdAt).getTime() > 3 * 60 * 1000) {
          await settleAttempt({ provider: 'mpesa', attemptId: attempt.id, outcome: 'failed', reason: 'No response from M-Pesa (timed out).' });
        }
      } else {
        await settleAttempt({
          provider: 'mpesa', attemptId: attempt.id, outcome: q.state,
          // The query API has no receipt number; the callback (if it arrives) is authoritative.
          reference: q.receipt || attempt.providerSessionId, amount: q.amount, reason: q.message, raw: q.raw
        });
      }
    } else if (attempt.provider === 'stripe') {
      const session = await stripe.retrieveCheckoutSession(attempt.providerSessionId);
      const outcome = stripe.sessionOutcome(session);
      if (outcome !== 'pending') {
        await settleAttempt({
          provider: 'stripe', attemptId: attempt.id, outcome,
          reference: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
          amount: session.amount_total != null ? stripe.fromMinorUnits(session.amount_total, session.currency) : undefined,
          reason: outcome === 'cancelled' ? 'Card payment session expired.' : undefined,
          raw: { id: session.id, payment_status: session.payment_status, status: session.status }
        });
      }
    }
  } catch (err) {
    console.error('[payments] status refresh failed:', err.message);
  }
  const [fresh] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.id, attempt.id)).limit(1);
  return fresh;
}

export async function paymentStatusForOrder(orderId) {
  let attempt = await latestAttempt(orderId);
  attempt = await refreshAttempt(attempt);
  const order = await findOrderByIdentifier(orderId);
  return {
    orderNumber: order.orderNumber,
    orderStatus: order.status,
    paymentStatus: order.paymentStatus,
    paymentReference: order.paymentReference,
    total: order.total,
    attempt: toApiAttempt(attempt)
  };
}

export async function listPaymentAttempts({ provider, status, limit = 100 } = {}) {
  const conditions = [];
  if (provider) conditions.push(eq(paymentAttempts.provider, provider));
  if (status) conditions.push(eq(paymentAttempts.status, status));
  const rows = await db.select().from(paymentAttempts)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(paymentAttempts.createdAt)).limit(Math.min(Number(limit) || 100, 500));
  return rows.map((r) => ({ ...toApiAttempt(r), orderId: r.orderId }));
}

async function emailReceipt(order, receipt) {
  const company = await getCompanyProfile();
  const pdf = await receiptPdfBuffer({ order, receipt, company });
  await sendPaymentConfirmationEmail(order, receipt, {
    attachments: [{ filename: `${receipt.receiptNumber}.pdf`, content: pdf, contentType: 'application/pdf' }]
  });
}

async function checkAndAlertLowStock(order) {
  const lowStockProducts = [];
  for (const item of order.items) {
    const product = await getProductById(item.productId);
    if (product && product.stock <= product.reorderLevel) lowStockProducts.push(product);
  }
  if (!lowStockProducts.length) return;
  const company = await getCompanyProfile();
  if (company?.email) await sendLowStockAlertEmail(company.email, lowStockProducts);
}

export { mpesa, stripe };
