import { and, count, desc, eq, ne, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { coupons, couponRedemptions, orders, users } from '../db/schema.js';

function toApiCoupon(row, reserved = 0) {
  const now = new Date();
  const state = !row.isActive ? 'inactive'
    : row.validUntil && row.validUntil <= now ? 'expired'
      : row.validFrom && row.validFrom > now ? 'scheduled'
        : row.usageLimit != null && row.usedCount + reserved >= row.usageLimit ? 'exhausted'
          : 'active';
  return {
    ...row,
    discountValue: Number(row.discountValue),
    minOrderAmount: Number(row.minOrderAmount || 0),
    maxDiscountAmount: row.maxDiscountAmount == null ? null : Number(row.maxDiscountAmount),
    reservedCount: reserved,
    state
  };
}

export async function listCoupons({ includeReferral = false } = {}) {
  const rows = await db.select().from(coupons)
    .where(includeReferral ? undefined : ne(coupons.source, 'referral'))
    .orderBy(desc(coupons.createdAt)).limit(500);
  const reserved = await db.select({ couponId: couponRedemptions.couponId, total: count() }).from(couponRedemptions)
    .where(eq(couponRedemptions.status, 'reserved')).groupBy(couponRedemptions.couponId);
  const reservedMap = Object.fromEntries(reserved.map((r) => [r.couponId, Number(r.total)]));
  return rows.map((r) => toApiCoupon(r, reservedMap[r.id] || 0));
}

export async function findCouponById(id) {
  const [row] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
  return row || null;
}

export async function findCouponByCode(code) {
  const [row] = await db.select().from(coupons).where(eq(coupons.code, code.toUpperCase().trim())).limit(1);
  return row || null;
}

export async function createCoupon(data) {
  const [row] = await db.insert(coupons).values({ ...data, code: data.code.toUpperCase().trim() }).returning();
  return toApiCoupon(row);
}

export async function updateCoupon(id, patch) {
  const values = { ...patch, updatedAt: new Date() };
  if (values.code) values.code = values.code.toUpperCase().trim();
  const [row] = await db.update(coupons).set(values).where(eq(coupons.id, id)).returning();
  return row ? toApiCoupon(row) : null;
}

export async function deleteCouponIfUnused(id) {
  const coupon = await findCouponById(id);
  if (!coupon) return null;
  const [used] = await db.select({ total: count() }).from(couponRedemptions).where(eq(couponRedemptions.couponId, id));
  if (coupon.usedCount > 0 || Number(used?.total || 0) > 0) {
    await db.update(coupons).set({ isActive: false, updatedAt: new Date() }).where(eq(coupons.id, id));
    return { deleted: false, code: coupon.code };
  }
  await db.delete(coupons).where(eq(coupons.id, id));
  return { deleted: true, code: coupon.code };
}

export async function listRedemptions(couponId) {
  return db.select({
    id: couponRedemptions.id,
    status: couponRedemptions.status,
    discountAmount: sql`${couponRedemptions.discountAmount}::float`,
    createdAt: couponRedemptions.createdAt,
    orderNumber: orders.orderNumber,
    orderTotal: sql`${orders.total}::float`,
    customerName: users.name,
    customerEmail: users.email
  }).from(couponRedemptions)
    .innerJoin(orders, eq(orders.id, couponRedemptions.orderId))
    .leftJoin(users, eq(users.id, couponRedemptions.userId))
    .where(and(eq(couponRedemptions.couponId, couponId)))
    .orderBy(desc(couponRedemptions.createdAt)).limit(500);
}
