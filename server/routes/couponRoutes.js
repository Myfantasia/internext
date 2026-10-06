import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  listCoupons, findCouponById, createCoupon, updateCoupon, deleteCouponIfUnused, listRedemptions
} from '../repositories/couponsRepo.js';
import { logAudit } from '../repositories/auditLogsRepo.js';
import { requireAuth, requirePermission } from '../middleware/authorize.js';
import { formatZodError } from '../schemas/authSchemas.js';
import { db } from '../db/client.js';
import { priceCart, OrderError } from '../repositories/ordersRepo.js';
import { isUuid } from '../db/util.js';

const router = express.Router();

// Slows down brute-force guessing of codes.
const validateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { valid: false, message: 'Too many promo code attempts. Please wait a few minutes.' } });

const DURATION_MS = { hours: 3_600_000, days: 86_400_000, weeks: 604_800_000 };

const couponSchema = z.object({
  code: z.string().trim().toUpperCase().min(3, 'Code must be at least 3 characters').max(40)
    .regex(/^[A-Z0-9_-]+$/, 'Use letters, numbers, - and _ only'),
  description: z.string().trim().max(500).optional().nullable(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.coerce.number().positive('Discount must be greater than zero').max(10_000_000),
  minOrderAmount: z.coerce.number().min(0).max(1e9).optional().nullable(),
  maxDiscountAmount: z.coerce.number().positive().max(1e9).optional().nullable(),
  validFrom: z.coerce.date().optional().nullable(),
  // Expiry: either an exact date/time or a duration measured from validFrom (or now).
  validUntil: z.coerce.date().optional().nullable(),
  duration: z.object({ value: z.coerce.number().int().positive().max(10_000), unit: z.enum(['hours', 'days', 'weeks']) }).optional().nullable(),
  usageLimit: z.coerce.number().int().positive().max(1_000_000).optional().nullable(),
  perUserLimit: z.coerce.number().int().positive().max(1000).optional().nullable(),
  eligibleProductIds: z.array(z.string().uuid()).max(500).optional(),
  eligibleCategoryIds: z.array(z.string().uuid()).max(100).optional(),
  stackWithFlashDeals: z.boolean().optional(),
  isActive: z.boolean().optional()
}).superRefine((d, ctx) => {
  if (d.discountType === 'percentage' && d.discountValue > 100) ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'A percentage discount cannot exceed 100%' });
  if (d.validUntil && d.duration) ctx.addIssue({ code: 'custom', path: ['validUntil'], message: 'Set either an expiry date or a duration, not both' });
});

function toColumns(d) {
  const validFrom = d.validFrom ?? null;
  let validUntil = d.validUntil ?? null;
  if (d.duration) validUntil = new Date((validFrom ? validFrom.getTime() : Date.now()) + d.duration.value * DURATION_MS[d.duration.unit]);
  if (validFrom && validUntil && validUntil <= validFrom) return { error: 'The expiry must be after the start date' };
  return {
    data: {
      code: d.code,
      description: d.description || null,
      discountType: d.discountType,
      discountValue: String(d.discountValue),
      minOrderAmount: String(d.minOrderAmount ?? 0),
      maxDiscountAmount: d.maxDiscountAmount == null ? null : String(d.maxDiscountAmount),
      validFrom,
      validUntil,
      usageLimit: d.usageLimit ?? null,
      perUserLimit: d.perUserLimit ?? null,
      eligibleProductIds: d.eligibleProductIds || [],
      eligibleCategoryIds: d.eligibleCategoryIds || [],
      stackWithFlashDeals: d.stackWithFlashDeals ?? false,
      isActive: d.isActive ?? true
    }
  };
}

// 1. Validate a code against the signed-in user's current cart. The discount
// is computed from server prices; the browser's numbers are never used.
router.post('/validate', requireAuth, validateLimiter, async (req, res) => {
  const code = String(req.body?.code || '').trim();
  if (!code) return res.status(400).json({ valid: false, message: 'Enter a promo code' });
  try {
    const priced = await db.transaction((tx) => priceCart(tx, { userId: req.user.id, couponCode: code }));
    if (!priced.coupon) return res.status(400).json({ valid: false, message: priced.couponError || 'This promo code is not valid.' });
    res.json({
      valid: true,
      code: priced.coupon.code,
      discountType: priced.coupon.discountType,
      discountValue: Number(priced.coupon.discountValue),
      calculatedDiscount: priced.discountAmount,
      description: priced.coupon.description
    });
  } catch (err) {
    if (err instanceof OrderError) return res.status(err.status).json({ valid: false, message: err.message });
    throw err;
  }
});

// 2. Staff: list promo codes (with live usage counts)
router.get('/', requirePermission('coupons:read'), async (req, res) => {
  const includeReferral = req.query.includeReferral === 'true';
  res.json({ success: true, coupons: await listCoupons({ includeReferral }) });
});

router.get('/:id/redemptions', requirePermission('coupons:read'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Promo code not found' });
  res.json({ success: true, redemptions: await listRedemptions(req.params.id) });
});

// 3. Admin: create
router.post('/', requirePermission('coupons:write'), async (req, res) => {
  const parsed = couponSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const cols = toColumns(parsed.data);
  if (cols.error) return res.status(400).json({ success: false, message: cols.error });
  try {
    const coupon = await createCoupon({ ...cols.data, createdBy: req.user.id });
    await logAudit({
      actorId: req.user.id, actorName: req.user.name, action: 'COUPON_CREATE', entity: 'Promotion', entityId: coupon.id,
      newValue: `${coupon.code}: ${coupon.discountValue}${coupon.discountType === 'percentage' ? '%' : ' KES'}`, ip: req.ip
    });
    res.status(201).json({ success: true, coupon });
  } catch (err) {
    if (err?.code === '23505' || err?.cause?.code === '23505') return res.status(409).json({ success: false, message: 'A promo code with this name already exists.' });
    throw err;
  }
});

// 4. Admin: edit
router.put('/:id', requirePermission('coupons:write'), async (req, res) => {
  if (!isUuid(req.params.id) || !(await findCouponById(req.params.id))) return res.status(404).json({ success: false, message: 'Promo code not found' });
  const parsed = couponSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const cols = toColumns(parsed.data);
  if (cols.error) return res.status(400).json({ success: false, message: cols.error });
  try {
    const coupon = await updateCoupon(req.params.id, cols.data);
    await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'COUPON_UPDATE', entity: 'Promotion', entityId: coupon.id, newValue: coupon.code, ip: req.ip });
    res.json({ success: true, coupon });
  } catch (err) {
    if (err?.code === '23505' || err?.cause?.code === '23505') return res.status(409).json({ success: false, message: 'A promo code with this name already exists.' });
    throw err;
  }
});

// 5. Admin: activate / deactivate
router.patch('/:id/status', requirePermission('coupons:write'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Promo code not found' });
  const isActive = req.body?.isActive === true;
  const coupon = await updateCoupon(req.params.id, { isActive });
  if (!coupon) return res.status(404).json({ success: false, message: 'Promo code not found' });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: isActive ? 'COUPON_ACTIVATE' : 'COUPON_DEACTIVATE', entity: 'Promotion', entityId: coupon.id, newValue: coupon.code, ip: req.ip });
  res.json({ success: true, coupon });
});

// 6. Admin: delete — only codes that were never used; used codes are deactivated to keep history.
router.delete('/:id', requirePermission('coupons:write'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Promo code not found' });
  const result = await deleteCouponIfUnused(req.params.id);
  if (!result) return res.status(404).json({ success: false, message: 'Promo code not found' });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: result.deleted ? 'COUPON_DELETE' : 'COUPON_DEACTIVATE', entity: 'Promotion', entityId: req.params.id, newValue: result.code, ip: req.ip });
  res.json({ success: true, deleted: result.deleted, message: result.deleted ? 'Promo code removed' : 'This code has been used, so it was deactivated to preserve order history.' });
});

export default router;
