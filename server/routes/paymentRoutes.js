import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../middleware/authorize.js';
import { findOrderByIdentifier, findOrderByPaymentReference, canAccessOrder, markOrderRefunded } from '../repositories/ordersRepo.js';
import { logAudit } from '../repositories/auditLogsRepo.js';
import { normalizeKenyanPhone } from '../services/location.js';
import { formatZodError } from '../schemas/authSchemas.js';
import {
  startPayment, paymentStatusForOrder, settleAttempt, recordEvent, markEventProcessed, listPaymentAttempts,
  PaymentError, mpesa, stripe
} from '../services/payments/index.js';
import {
  submitBankTransfer, reviewBankTransfer, recordCollectedPayment, listBankSubmissions, COLLECTION_METHODS
} from '../services/payments/offline.js';
import { sendBankTransferReceivedEmail, sendBankTransferRejectedEmail } from '../services/email/index.js';

const router = express.Router();

const startLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many payment attempts. Please wait a few minutes.' } });

const startSchema = z.object({
  provider: z.enum(['mpesa', 'stripe']),
  phone: z.string().trim().max(30).optional()
});

async function loadOwnedOrder(req, res) {
  const order = await findOrderByIdentifier(String(req.params.orderId).slice(0, 64));
  if (!order || !canAccessOrder(req.user, order)) {
    res.status(404).json({ success: false, message: 'Order not found' });
    return null;
  }
  return order;
}

// Customer starts (or retries) payment for their own order.
router.post('/orders/:orderId/start', requireAuth, startLimiter, async (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const order = await loadOwnedOrder(req, res);
  if (!order) return;

  let phone = null;
  if (parsed.data.provider === 'mpesa') {
    phone = normalizeKenyanPhone(parsed.data.phone || order.customer.phone);
    if (!phone) return res.status(400).json({ success: false, message: 'Enter a valid Safaricom number, e.g. 0712 345 678.' });
  }

  try {
    const result = await startPayment({ order, provider: parsed.data.provider, user: req.user, phone });
    await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'PAYMENT_STARTED', entity: 'Order', entityId: order.id, newValue: parsed.data.provider, ip: req.ip });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    if (err instanceof PaymentError) return res.status(err.status).json({ success: false, code: err.code, message: err.message });
    throw err;
  }
});

// ---------------------------------------------------------------------------
// Bank transfer: the customer reports a transfer; staff verify it.
// ---------------------------------------------------------------------------
const bankSubmitSchema = z.object({
  reference: z.string().trim().min(4, 'Enter the transaction reference from your bank slip or app').max(40)
    .regex(/^[A-Za-z0-9\-\/ ]+$/, 'Use only the letters and numbers of the reference'),
  amount: z.coerce.number().positive('Enter the amount you sent').max(100_000_000),
  paidOn: z.coerce.date().refine((d) => d.getTime() <= Date.now() + 60_000 && d.getTime() > Date.now() - 30 * 86400_000, { message: 'Enter the date you made the transfer' }),
  payerName: z.string().trim().max(120).optional(),
  bankName: z.string().trim().max(80).optional()
});

const submitLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many submissions. Please wait a while or contact support.' } });

router.post('/orders/:orderId/bank-transfer', requireAuth, submitLimiter, async (req, res) => {
  const parsed = bankSubmitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const order = await loadOwnedOrder(req, res);
  if (!order) return;
  try {
    await submitBankTransfer({ order, user: req.user, ...parsed.data, paidOn: parsed.data.paidOn.toISOString(), ip: req.ip });
    const fresh = await findOrderByIdentifier(order.id);
    sendBankTransferReceivedEmail(fresh, parsed.data).catch((e) => console.error('Failed to send transfer-received email:', e));
    res.status(201).json({ success: true, message: 'Thanks! We will confirm your transfer once it reflects in our account — usually within one business day.' });
  } catch (err) {
    if (err instanceof PaymentError) return res.status(err.status).json({ success: false, code: err.code, message: err.message });
    throw err;
  }
});

router.get('/bank-transfers', requirePermission('payments:read'), async (req, res) => {
  const status = ['pending', 'succeeded', 'failed', 'cancelled'].includes(req.query.status) ? req.query.status : (req.query.status === 'all' ? null : 'pending');
  res.json({ success: true, transfers: await listBankSubmissions({ status, limit: req.query.limit }) });
});

const reviewSchema = z.object({
  approve: z.boolean(),
  amountReceived: z.coerce.number().positive().max(100_000_000).optional(),
  reason: z.string().trim().max(300).optional()
}).superRefine((d, ctx) => {
  if (d.approve && !d.amountReceived) ctx.addIssue({ code: 'custom', path: ['amountReceived'], message: 'Enter the amount that reached the account' });
  if (!d.approve && (!d.reason || d.reason.length < 5)) ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Tell the customer why the transfer could not be verified' });
});

router.post('/bank-transfers/:attemptId/review', requirePermission('orders:update_status'), async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  try {
    const order = await reviewBankTransfer({ attemptId: String(req.params.attemptId).slice(0, 64), ...parsed.data, staff: req.user, ip: req.ip });
    if (!parsed.data.approve && order) {
      sendBankTransferRejectedEmail(order, parsed.data.reason).catch((e) => console.error('Failed to send transfer-rejected email:', e));
    }
    res.json({ success: true, order });
  } catch (err) {
    if (err instanceof PaymentError) return res.status(err.status).json({ success: false, code: err.code, message: err.message });
    throw err;
  }
});

// Staff record money taken in person: pay on delivery (cash / M-Pesa till /
// card POS) or a bank deposit seen on the statement.
const recordSchema = z.object({
  method: z.enum(Object.keys(COLLECTION_METHODS)),
  amount: z.coerce.number().positive('Enter the amount received').max(100_000_000),
  reference: z.string().trim().max(60).optional(),
  note: z.string().trim().max(300).optional()
});

router.post('/orders/:orderId/record', requirePermission('orders:update_status'), async (req, res) => {
  const parsed = recordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const order = await findOrderByIdentifier(String(req.params.orderId).slice(0, 64));
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  try {
    const updated = await recordCollectedPayment({ order, ...parsed.data, staff: req.user, ip: req.ip });
    res.json({ success: true, order: updated });
  } catch (err) {
    if (err instanceof PaymentError) return res.status(err.status).json({ success: false, code: err.code, message: err.message });
    throw err;
  }
});

// Polled by the checkout / confirmation page.
router.get('/orders/:orderId/status', requireAuth, async (req, res) => {
  const order = await loadOwnedOrder(req, res);
  if (!order) return;
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, ...(await paymentStatusForOrder(order.id)) });
});

// ---------------------------------------------------------------------------
// Safaricom Daraja STK callback. Daraja does not sign callbacks, so:
//  1. the URL carries a long random secret (MPESA_CALLBACK_SECRET),
//  2. the CheckoutRequestID must match a pending attempt we created,
//  3. a "success" is re-verified with Daraja's STK query before the order is
//     marked paid, and the amount must cover the order total.
// Safaricom always gets a 200 so it does not keep retrying.
// ---------------------------------------------------------------------------
router.post('/mpesa/callback/:secret', async (req, res) => {
  const ack = () => res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  if (!mpesa.isCallbackSecretValid(req.params.secret)) {
    console.warn(`[mpesa] callback with invalid secret from ${req.ip}`);
    return res.status(404).json({ success: false });
  }

  const result = mpesa.parseCallback(req.body);
  if (!result) return ack();

  const eventId = `${result.sessionId}:${result.resultCode}`;
  if (!(await recordEvent('mpesa', eventId, 'stk_callback', req.body))) return ack();

  try {
    let outcome = result.state;
    if (outcome === 'succeeded' && process.env.MPESA_VERIFY_CALLBACKS !== 'false' && mpesa.mpesaEnv() !== 'simulation') {
      const confirmation = await mpesa.queryStkStatus(result.sessionId);
      if (confirmation.state !== 'succeeded') {
        console.warn(`[mpesa] callback claimed success for ${result.sessionId} but query says ${confirmation.state}`);
        // Leave pending; the status poll will settle it from Daraja's answer.
        return ack();
      }
    }
    await settleAttempt({
      provider: 'mpesa', sessionId: result.sessionId, outcome,
      reference: result.receipt, amount: result.amount, reason: result.message,
      raw: { resultCode: result.resultCode, receipt: result.receipt, amount: result.amount }
    });
    await markEventProcessed('mpesa', eventId);
  } catch (err) {
    console.error('[mpesa] callback processing failed:', err);
  }
  return ack();
});

// ---------------------------------------------------------------------------
// Stripe webhook. Mounted with express.raw() in server/index.js because the
// signature is computed over the exact raw body.
// ---------------------------------------------------------------------------
export async function stripeWebhookHandler(req, res) {
  let event;
  try {
    event = stripe.verifyWebhook(req.body, req.headers['stripe-signature']);
  } catch (err) {
    console.warn('[stripe] webhook signature verification failed:', err.message);
    return res.status(400).send('Invalid signature');
  }

  if (!(await recordEvent('stripe', event.id, event.type, { id: event.id, type: event.type }))) {
    return res.json({ received: true, duplicate: true });
  }

  try {
    const obj = event.data.object;
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const outcome = stripe.sessionOutcome(obj);
        if (outcome === 'succeeded') {
          await settleAttempt({
            provider: 'stripe', sessionId: obj.id, outcome,
            reference: typeof obj.payment_intent === 'string' ? obj.payment_intent : obj.payment_intent?.id,
            amount: stripe.fromMinorUnits(obj.amount_total, obj.currency),
            raw: { id: obj.id, payment_status: obj.payment_status }
          });
        }
        break;
      }
      case 'checkout.session.async_payment_failed':
        await settleAttempt({ provider: 'stripe', sessionId: obj.id, outcome: 'failed', reason: 'The card payment failed.' });
        break;
      case 'checkout.session.expired':
        await settleAttempt({ provider: 'stripe', sessionId: obj.id, outcome: 'cancelled', reason: 'The card payment page expired before payment.' });
        break;
      case 'charge.refunded': {
        // Only full refunds change the order; partial refunds stay a manual note.
        const paymentIntent = typeof obj.payment_intent === 'string' ? obj.payment_intent : obj.payment_intent?.id;
        const order = paymentIntent ? await findOrderByPaymentReference(paymentIntent) : null;
        if (order && obj.refunded) await markOrderRefunded(order.id, { reference: paymentIntent });
        break;
      }
      default:
        break;
    }
    await markEventProcessed('stripe', event.id);
    res.json({ received: true });
  } catch (err) {
    console.error('[stripe] webhook processing failed:', err);
    // 500 makes Stripe redeliver; recordEvent lets an unprocessed event through again.
    res.status(500).json({ received: false });
  }
}

// Staff: Payments / Transactions dashboard.
router.get('/', requirePermission('payments:read'), async (req, res) => {
  const attempts = await listPaymentAttempts({ provider: req.query.provider, status: req.query.status, limit: req.query.limit });
  res.json({ success: true, attempts });
});

// Which methods are configured — lets the checkout hide unavailable ones.
router.get('/methods', async (_req, res) => {
  let mpesaMode = null;
  try {
    mpesaMode = mpesa.mpesaEnv();
  } catch {
    mpesaMode = null;
  }
  const mpesaReady = mpesaMode === 'simulation' || !!(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_PASSKEY && process.env.MPESA_CALLBACK_SECRET);
  res.json({
    success: true,
    mpesa: { available: mpesaReady, mode: mpesaMode },
    card: { available: !!process.env.STRIPE_SECRET_KEY, testMode: (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test_') }
  });
});

export default router;
