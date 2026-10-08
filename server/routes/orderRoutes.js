import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { db } from '../db/client.js';
import {
  createOrder, findOrderByIdentifier, findOrdersForUser, findOrdersForCustomerOrPhone, listOrdersPage,
  updateOrderStatus, cancelUnpaidOrder, canAccessOrder, priceCart, OrderError, PAYMENT_METHODS, CASH_ON_DELIVERY_MAX_KM
} from '../repositories/ordersRepo.js';
import { logAudit } from '../repositories/auditLogsRepo.js';
import { sendOrderConfirmationEmail, sendOrderStatusUpdateEmail } from '../services/email/index.js';
import { requireAuth, requirePermission } from '../middleware/authorize.js';
import { formatZodError } from '../schemas/authSchemas.js';
import { isValidCounty, normalizeKenyanPhone } from '../services/location.js';
import { orderStatusEnum, paymentStatusEnum } from '../db/schema.js';
import { getCompanyProfile } from '../repositories/companyProfileRepo.js';
import { paymentInstructions, pendingBankSubmission, BANK_LABEL } from '../services/payments/offline.js';

// What the owner sees on their order page for an unpaid offline order: how to
// pay (bank details / amount to have ready) and any transfer awaiting review.
async function withPaymentGuidance(order, company) {
  const instructions = paymentInstructions(order, company);
  const pending = instructions?.kind === 'bank_transfer' ? await pendingBankSubmission(order.id) : null;
  return {
    ...order,
    paymentInstructions: instructions,
    pendingTransfer: pending ? {
      id: pending.id, reference: pending.providerReference, amount: Number(pending.amount),
      paidOn: pending.rawResponse?.paidOn || null, submittedAt: pending.createdAt
    } : null
  };
}

const router = express.Router();

const STAFF_ROLES = ['ADMIN', 'SALES_MANAGER'];

const checkoutLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many checkout attempts. Please wait a few minutes.' } });

const coordinate = z.union([z.number(), z.string().trim().max(20)]).optional().nullable();
const deliverySchema = z.object({
  mode: z.enum(['distance', 'option']),
  optionId: z.string().uuid().optional(),
  coordinates: z.object({ lat: coordinate, lng: coordinate }).optional().nullable(),
  county: z.string().trim().max(60).optional()
});
const addressSchema = z.object({
  county: z.string().trim().max(60).optional(),
  town: z.string().trim().max(120).optional(),
  street: z.string().trim().max(200).optional(),
  building: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(500).optional(),
  lat: coordinate,
  lng: coordinate
});

const previewSchema = z.object({
  couponCode: z.string().trim().max(40).optional().nullable(),
  delivery: deliverySchema.optional().nullable()
});

const createOrderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2, 'Enter your full name').max(120),
    email: z.string().trim().toLowerCase().email('Enter a valid email address').max(200),
    phone: z.string().trim().max(30).refine((v) => !!normalizeKenyanPhone(v), { message: 'Enter a valid Kenyan mobile number' })
  }),
  couponCode: z.string().trim().max(40).optional().nullable(),
  delivery: deliverySchema,
  address: addressSchema.optional(),
  paymentMethod: z.enum(Object.keys(PAYMENT_METHODS))
}).superRefine((data, ctx) => {
  if (data.delivery.mode === 'distance') {
    if (!data.address?.county || !isValidCounty(data.address.county)) ctx.addIssue({ code: 'custom', path: ['address', 'county'], message: 'Choose your county' });
    if (!data.address?.town || data.address.town.length < 2) ctx.addIssue({ code: 'custom', path: ['address', 'town'], message: 'Enter your town or area' });
    if (!data.address?.street || data.address.street.length < 2) ctx.addIssue({ code: 'custom', path: ['address', 'street'], message: 'Enter your street or road' });
  }
  if (data.delivery.mode === 'option' && !data.delivery.optionId) ctx.addIssue({ code: 'custom', path: ['delivery'], message: 'Choose a delivery option' });
});

function sendOrderError(res, err) {
  return res.status(err.status).json({ success: false, message: err.message, code: err.code, productId: err.productId, available: err.available });
}

// Public tracking reveals progress only. Contact details, items and amounts
// are limited to the order's owner and staff.
function redactOrderForPublic(order) {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    deliveryMethod: order.deliveryMethod,
    trackingNumber: order.trackingNumber,
    deliveryAddress: { county: order.deliveryAddress?.county, town: order.deliveryAddress?.town },
    itemCount: order.items.reduce((n, i) => n + i.quantity, 0),
    timeline: order.timeline,
    createdAt: order.createdAt,
    limited: true
  };
}

function publicCheckoutOptions() {
  return Object.entries(PAYMENT_METHODS).map(([key, m]) => ({ key, label: m.label, online: m.online }));
}

// 0. Checkout configuration + live server-side pricing of the user's cart.
router.post('/preview', requireAuth, async (req, res) => {
  const parsed = previewSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  try {
    const priced = await db.transaction((tx) => priceCart(tx, { userId: req.user.id, couponCode: parsed.data.couponCode, delivery: parsed.data.delivery }));
    res.json({
      success: true,
      summary: {
        items: priced.lines.map((l) => ({
          productId: l.productId, variantId: l.variantId, name: l.name, variantName: l.variantName, quantity: l.quantity,
          unitPrice: l.unitPrice, originalUnitPrice: l.originalUnitPrice, lineTotal: l.lineTotal, hasFlashDeal: l.hasFlashDeal, thumbnail: l.thumbnailUrl
        })),
        subtotal: priced.subtotal,
        flashDealSavings: priced.flashDealSavings,
        discountAmount: priced.discountAmount,
        coupon: priced.coupon ? { code: priced.coupon.code, description: priced.coupon.description } : null,
        couponError: priced.couponError,
        delivery: priced.deliveryQuote,
        deliveryError: priced.deliveryError,
        deliveryFee: priced.deliveryFee,
        taxRate: priced.taxRate,
        pricesIncludeTax: priced.pricesIncludeTax,
        taxAmount: priced.taxAmount,
        total: priced.total
      },
      paymentMethods: publicCheckoutOptions(),
      cashOnDeliveryMaxKm: CASH_ON_DELIVERY_MAX_KM
    });
  } catch (err) {
    if (err instanceof OrderError) return sendOrderError(res, err);
    throw err;
  }
});

// 1. Create order from the signed-in user's server-side cart. The browser
// sends choices (delivery, coupon, payment method) — never prices.
router.post('/', requireAuth, checkoutLimiter, async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const { customer, couponCode, delivery, address, paymentMethod } = parsed.data;

  try {
    const order = await createOrder({
      userId: req.user.id,
      customer: { ...customer, phone: normalizeKenyanPhone(customer.phone) },
      couponCode,
      delivery: { ...delivery, county: delivery.county || address?.county },
      address,
      paymentMethodKey: paymentMethod
    });

    await logAudit({
      actorId: req.user.id, actorName: req.user.name, action: 'ORDER_CREATED', entity: 'Order',
      entityId: order.id, newValue: `Total: KES ${order.total.toLocaleString('en-KE')} (${order.paymentMethod})`, ip: req.ip
    });

    const company = await getCompanyProfile();
    const guided = await withPaymentGuidance(order, company);
    sendOrderConfirmationEmail(order, { instructions: guided.paymentInstructions }).catch((e) => console.error('Failed to send order confirmation email:', e));
    res.status(201).json({ success: true, order: guided });
  } catch (err) {
    if (err instanceof OrderError) return sendOrderError(res, err);
    throw err;
  }
});

// 2. The signed-in customer's own orders (account-scoped).
router.get('/mine', requireAuth, async (req, res) => {
  res.json({ success: true, orders: await findOrdersForUser(req.user) });
});

// 3. Staff lookup of any customer's orders by email/phone.
router.get('/customer/:query', requireAuth, async (req, res) => {
  const isStaff = STAFF_ROLES.includes(req.user.role);
  const orders = isStaff ? await findOrdersForCustomerOrPhone(String(req.params.query).slice(0, 200)) : await findOrdersForUser(req.user);
  res.json({ success: true, orders });
});

// 4. Admin/Sales Manager: list orders with filters.
// Paged, filtered and sorted in SQL (see listOrdersPage).
router.get('/', requirePermission('orders:read'), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, ...(await listOrdersPage(req.query)) });
});

// 5. Order by number or id — owner/staff get everything, anyone else gets tracking progress only.
router.get('/:identifier', async (req, res) => {
  const order = await findOrderByIdentifier(String(req.params.identifier).slice(0, 64));
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  if (!canAccessOrder(req.user, order)) return res.json({ success: true, order: redactOrderForPublic(order) });
  res.json({ success: true, order: await withPaymentGuidance(order, await getCompanyProfile()) });
});

// 6. Customer cancels an unpaid order (releases stock and promo-code use).
router.post('/:id/cancel', requireAuth, async (req, res) => {
  const order = await findOrderByIdentifier(req.params.id);
  if (!order || !canAccessOrder(req.user, order)) return res.status(404).json({ success: false, message: 'Order not found' });
  try {
    const updated = await cancelUnpaidOrder(order.id, { changedByUserId: req.user.id });
    await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'ORDER_CANCELLED', entity: 'Order', entityId: order.id, ip: req.ip });
    res.json({ success: true, order: updated });
  } catch (err) {
    if (err instanceof OrderError) return sendOrderError(res, err);
    throw err;
  }
});

// 7. Admin/Sales Manager: update order status & fulfilment timeline.
const statusUpdateSchema = z.object({
  status: z.enum(orderStatusEnum.enumValues).optional(),
  paymentStatus: z.enum(paymentStatusEnum.enumValues).optional(),
  note: z.string().trim().max(500).optional(),
  trackingNumber: z.string().trim().max(60).optional()
});

router.put('/:id/status', requirePermission('orders:update_status'), async (req, res) => {
  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const { status, note, trackingNumber, paymentStatus } = parsed.data;

  // Bank-transfer orders ship only once the money is verified.
  if (status && ['Packed', 'Dispatched', 'Out for Delivery', 'Delivered'].includes(status)) {
    const current = await findOrderByIdentifier(req.params.id);
    if (current && current.paymentMethod === BANK_LABEL && current.paymentStatus !== 'Paid') {
      return res.status(409).json({ success: false, code: 'PAYMENT_REQUIRED', message: 'This bank-transfer order is not paid yet. Verify the transfer under Payments before packing or dispatching it.' });
    }
  }

  let result;
  try {
    result = await updateOrderStatus(req.params.id, { status, note, trackingNumber, paymentStatus, changedByUserId: req.user.id });
  } catch (err) {
    if (err instanceof OrderError) return sendOrderError(res, err);
    throw err;
  }
  if (!result) return res.status(404).json({ success: false, message: 'Order not found' });

  await logAudit({
    actorId: req.user.id, actorName: req.user.name, action: 'ORDER_STATUS_UPDATE', entity: 'Order',
    entityId: result.order.id, previousValue: result.oldStatus, newValue: [status, paymentStatus].filter(Boolean).join(' / ') || result.oldStatus, ip: req.ip
  });

  if (status && status !== result.oldStatus) {
    sendOrderStatusUpdateEmail(result.order, note).catch((e) => console.error('Failed to send order status email:', e));
  }

  res.json({ success: true, order: result.order });
});

export default router;
