import { and, eq, inArray, ne, sql, count } from 'drizzle-orm';
import { coupons, couponRedemptions } from '../db/schema.js';
import { roundMoney } from './pricing.js';

// Promo-code rules, evaluated only on the server against server-priced lines.

export class CouponError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

export function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

const ACTIVE_REDEMPTION = inArray(couponRedemptions.status, ['reserved', 'redeemed']);

// lines: [{ productId, categoryId, lineTotal, hasFlashDeal }]
// With { lock: true } the coupon row is locked FOR UPDATE until the caller's
// transaction ends, so two concurrent checkouts cannot both take the last use.
export async function evaluateCoupon(tx, { code, userId, lines, lock = false, excludeOrderId = null }) {
  const normalized = normalizeCode(code);
  if (!normalized || normalized.length > 40) throw new CouponError('Enter a valid promo code.');

  let query = tx.select().from(coupons).where(eq(coupons.code, normalized)).limit(1);
  if (lock) query = query.for('update');
  const [coupon] = await query;

  // One generic message for "doesn't exist" and "belongs to someone else", so
  // codes can't be probed for validity.
  if (!coupon || (coupon.assignedUserId && coupon.assignedUserId !== userId)) throw new CouponError('This promo code is not valid.');
  if (!coupon.isActive) throw new CouponError('This promo code is no longer active.');
  const now = new Date();
  if (coupon.validFrom && coupon.validFrom > now) throw new CouponError('This promo code is not active yet.');
  if (coupon.validUntil && coupon.validUntil <= now) throw new CouponError('This promo code has expired.');

  const usageFilter = [eq(couponRedemptions.couponId, coupon.id), ACTIVE_REDEMPTION];
  if (excludeOrderId) usageFilter.push(ne(couponRedemptions.orderId, excludeOrderId));

  if (coupon.usageLimit != null) {
    // usedCount counts completed (paid) uses, including ones from before
    // redemption tracking existed; open reservations are checkouts in progress.
    const [reserved] = await tx.select({ total: count() }).from(couponRedemptions)
      .where(and(...usageFilter, eq(couponRedemptions.status, 'reserved')));
    if (Number(coupon.usedCount || 0) + Number(reserved?.total || 0) >= coupon.usageLimit) {
      throw new CouponError('This promo code has reached its usage limit.');
    }
  }
  if (coupon.perUserLimit != null && userId) {
    const [mine] = await tx.select({ total: count() }).from(couponRedemptions)
      .where(and(...usageFilter, eq(couponRedemptions.userId, userId)));
    if (Number(mine?.total || 0) >= coupon.perUserLimit) throw new CouponError('You have already used this promo code.');
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  if (coupon.minOrderAmount && subtotal < Number(coupon.minOrderAmount)) {
    throw new CouponError(`This promo code needs a minimum order of KES ${Number(coupon.minOrderAmount).toLocaleString('en-KE')}.`);
  }

  const productIds = new Set(coupon.eligibleProductIds || []);
  const categoryIds = new Set(coupon.eligibleCategoryIds || []);
  const restricted = productIds.size > 0 || categoryIds.size > 0;
  const eligible = lines.filter((l) =>
    (!restricted || productIds.has(l.productId) || categoryIds.has(l.categoryId)) &&
    (coupon.stackWithFlashDeals || !l.hasFlashDeal)
  );
  const eligibleSubtotal = eligible.reduce((sum, l) => sum + l.lineTotal, 0);
  if (eligibleSubtotal <= 0) {
    throw new CouponError(restricted
      ? 'This promo code does not apply to the items in your cart.'
      : 'This promo code cannot be combined with flash-deal prices.');
  }

  let discount = coupon.discountType === 'percentage'
    ? (eligibleSubtotal * Number(coupon.discountValue)) / 100
    : Number(coupon.discountValue);
  if (coupon.maxDiscountAmount != null) discount = Math.min(discount, Number(coupon.maxDiscountAmount));
  discount = roundMoney(Math.min(discount, eligibleSubtotal));

  return { coupon, discount, eligibleSubtotal };
}

export async function reserveCoupon(tx, { couponId, userId, orderId, discountAmount }) {
  await tx.insert(couponRedemptions).values({ couponId, userId, orderId, discountAmount: String(discountAmount), status: 'reserved' });
}

// Payment confirmed: the reservation becomes a redemption.
export async function redeemCouponForOrder(tx, orderId) {
  const [row] = await tx.update(couponRedemptions).set({ status: 'redeemed', updatedAt: new Date() })
    .where(and(eq(couponRedemptions.orderId, orderId), eq(couponRedemptions.status, 'reserved')))
    .returning();
  if (row) await tx.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1`, updatedAt: new Date() }).where(eq(coupons.id, row.couponId));
  return row || null;
}

// Order cancelled before payment: the use is given back.
export async function releaseCouponForOrder(tx, orderId) {
  await tx.update(couponRedemptions).set({ status: 'released', updatedAt: new Date() })
    .where(and(eq(couponRedemptions.orderId, orderId), eq(couponRedemptions.status, 'reserved')));
}
