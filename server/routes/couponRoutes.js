import express from 'express';
import { listCoupons, findCouponByCode, createCoupon, deleteCouponByCode } from '../repositories/couponsRepo.js';
import { logAudit } from '../repositories/auditLogsRepo.js';
import { requirePermission } from '../middleware/authorize.js';

const router = express.Router();

// 1. Validate Coupon for Checkout (public — needed for guest checkout)
router.post('/validate', async (req, res) => {
  const { code, orderAmount } = req.body;
  if (!code) {
    return res.status(400).json({ valid: false, message: 'Coupon code is required' });
  }

  const coupon = await findCouponByCode(code);
  if (!coupon) {
    return res.status(404).json({ valid: false, message: 'Invalid promotional code' });
  }
  if (!coupon.isActive) {
    return res.status(400).json({ valid: false, message: 'This coupon is currently inactive' });
  }
  if (coupon.validFrom && new Date(coupon.validFrom) > new Date()) {
    return res.status(400).json({ valid: false, message: 'This coupon is not active yet' });
  }
  if (coupon.validUntil && new Date(coupon.validUntil) < new Date()) {
    return res.status(400).json({ valid: false, message: 'This coupon has expired' });
  }
  if (coupon.minOrderAmount && Number(orderAmount) < Number(coupon.minOrderAmount)) {
    return res.status(400).json({ valid: false, message: `Minimum order of KES ${Number(coupon.minOrderAmount).toLocaleString()} required for this coupon` });
  }
  if (coupon.usageLimit && (coupon.usedCount || 0) >= coupon.usageLimit) {
    return res.status(400).json({ valid: false, message: 'Coupon usage limit reached' });
  }

  let discount = 0;
  if (coupon.discountType === 'percentage') {
    discount = (Number(orderAmount) * Number(coupon.discountValue)) / 100;
    if (coupon.maxDiscountAmount) discount = Math.min(discount, Number(coupon.maxDiscountAmount));
  } else {
    discount = Number(coupon.discountValue);
  }

  res.json({
    valid: true, code: coupon.code, discountType: coupon.discountType,
    discountValue: Number(coupon.discountValue), calculatedDiscount: discount, description: coupon.description
  });
});

// 2. Admin/Sales Manager: Get all coupons
router.get('/', requirePermission('coupons:read'), async (req, res) => {
  const coupons = await listCoupons();
  res.json({ success: true, coupons });
});

// 3. Admin: Create Coupon
router.post('/', requirePermission('coupons:write'), async (req, res) => {
  const coupon = await createCoupon({
    ...req.body,
    discountValue: String(req.body.discountValue),
    minOrderAmount: req.body.minOrderAmount ? String(req.body.minOrderAmount) : '0',
    maxDiscountAmount: req.body.maxDiscountAmount ? String(req.body.maxDiscountAmount) : null,
    isActive: req.body.isActive !== undefined ? req.body.isActive : true
  });

  await logAudit({
    actorId: req.user.id, actorName: req.user.name, action: 'COUPON_CREATE', entity: 'Promotion',
    entityId: coupon.id, newValue: `Discount: ${coupon.discountValue}${coupon.discountType === 'percentage' ? '%' : ' KES'}`, ip: req.ip
  });
  res.status(201).json({ success: true, coupon });
});

// 4. Admin: Delete Coupon
router.delete('/:code', requirePermission('coupons:write'), async (req, res) => {
  const deleted = await deleteCouponByCode(req.params.code);
  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Coupon not found' });
  }
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'COUPON_DELETE', entity: 'Promotion', entityId: deleted.id, previousValue: 'Active', newValue: 'Deleted', ip: req.ip });
  res.json({ success: true, message: 'Coupon removed' });
});

export default router;
