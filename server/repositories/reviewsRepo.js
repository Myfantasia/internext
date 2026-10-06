import { and, avg, count, desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { reviews, products, orders, orderItems } from '../db/schema.js';

// New and edited reviews wait for staff approval unless moderation is turned off.
export function moderationRequired() {
  return process.env.REVIEWS_REQUIRE_MODERATION !== 'false';
}

function toApiReview(r) {
  return {
    id: r.id,
    productId: r.productId,
    userName: r.userName,
    userCity: r.userCity,
    rating: r.rating,
    title: r.title,
    comment: r.comment,
    verifiedPurchase: r.verifiedPurchase,
    status: r.status,
    moderationNote: r.moderationNote,
    date: r.createdAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    ...(r.productName ? { productName: r.productName, productSlug: r.productSlug } : {})
  };
}

export async function listApprovedReviews(productId) {
  const rows = await db.select().from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.status, 'approved')))
    .orderBy(desc(reviews.createdAt)).limit(200);
  return rows.map(toApiReview);
}

export async function getRatingSummary(productId) {
  const rows = await db.select({ rating: reviews.rating, total: count() }).from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.status, 'approved')))
    .groupBy(reviews.rating);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let sum = 0;
  for (const r of rows) {
    distribution[r.rating] = Number(r.total);
    total += Number(r.total);
    sum += r.rating * Number(r.total);
  }
  return { average: total ? Math.round((sum / total) * 10) / 10 : 0, count: total, distribution };
}

const withProduct = { review: reviews, productName: products.name, productSlug: products.slug };

export async function listReviewsForModeration({ status } = {}) {
  const rows = await db.select(withProduct).from(reviews)
    .innerJoin(products, eq(products.id, reviews.productId))
    .where(status ? eq(reviews.status, status) : undefined)
    .orderBy(desc(reviews.createdAt)).limit(500);
  return rows.map((r) => toApiReview({ ...r.review, productName: r.productName, productSlug: r.productSlug }));
}

export async function listReviewsByUser(userId) {
  const rows = await db.select(withProduct).from(reviews)
    .innerJoin(products, eq(products.id, reviews.productId))
    .where(eq(reviews.userId, userId))
    .orderBy(desc(reviews.createdAt));
  return rows.map((r) => toApiReview({ ...r.review, productName: r.productName, productSlug: r.productSlug }));
}

export async function findReviewById(id) {
  const [row] = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
  return row || null;
}

async function hasPurchased(userId, productId) {
  const [row] = await db.select({ id: orderItems.id }).from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orders.userId, userId), eq(orderItems.productId, productId), eq(orders.paymentStatus, 'Paid')))
    .limit(1);
  return !!row;
}

// One review per customer per product: submitting again edits the existing one.
export async function upsertReview(user, { productId, rating, title, comment, userCity }) {
  const [product] = await db.select({ id: products.id, isActive: products.isActive }).from(products).where(eq(products.id, productId)).limit(1);
  if (!product || !product.isActive) return { error: 'Product not found', status: 404 };

  const verifiedPurchase = await hasPurchased(user.id, productId);
  const status = moderationRequired() ? 'pending' : 'approved';
  const values = { rating, title: title || null, comment, userCity: userCity || null, verifiedPurchase, status, moderationNote: null, updatedAt: new Date() };

  const [existing] = await db.select().from(reviews).where(and(eq(reviews.userId, user.id), eq(reviews.productId, productId))).limit(1);
  let row;
  if (existing) {
    [row] = await db.update(reviews).set(values).where(eq(reviews.id, existing.id)).returning();
  } else {
    [row] = await db.insert(reviews).values({ ...values, productId, userId: user.id, userName: user.name }).returning();
  }
  await recalculateProductRating(productId);
  return { review: toApiReview(row), created: !existing };
}

export async function deleteReview(id) {
  const [row] = await db.delete(reviews).where(eq(reviews.id, id)).returning();
  if (row) await recalculateProductRating(row.productId);
  return row || null;
}

export async function moderateReview(id, { status, note, moderatorId }) {
  const [row] = await db.update(reviews)
    .set({ status, moderationNote: note || null, moderatedBy: moderatorId, moderatedAt: new Date() })
    .where(eq(reviews.id, id)).returning();
  if (row) await recalculateProductRating(row.productId);
  return row ? toApiReview(row) : null;
}

// Only approved reviews count toward the public rating.
async function recalculateProductRating(productId) {
  const [agg] = await db
    .select({ avgRating: avg(reviews.rating), total: count() })
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.status, 'approved')));

  await db.update(products).set({
    rating: agg?.avgRating ? Number(agg.avgRating).toFixed(1) : '0',
    reviewsCount: Number(agg?.total || 0)
  }).where(eq(products.id, productId));
}
