import { and, desc, eq, gt, isNull, lt, lte, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { flashDeals, products } from '../db/schema.js';
import { applyDiscount } from '../services/pricing.js';
import { findProductByIdentifier } from './catalogRepo.js';

export function dealState(d, now = new Date()) {
  if (d.archivedAt) return 'archived';
  if (!d.isActive) return 'inactive';
  if (d.endsAt <= now) return 'expired';
  if (d.startsAt > now) return 'scheduled';
  if (d.quantityLimit != null && d.quantitySold >= d.quantityLimit) return 'sold_out';
  return 'active';
}

function toApiDeal(d, product) {
  const basePrice = product ? Number(product.price) : null;
  return {
    id: d.id,
    productId: d.productId,
    title: d.title,
    description: d.description,
    discountType: d.discountType,
    discountValue: Number(d.discountValue),
    startsAt: d.startsAt,
    endsAt: d.endsAt,
    quantityLimit: d.quantityLimit,
    quantitySold: d.quantitySold,
    remaining: d.quantityLimit == null ? null : Math.max(0, d.quantityLimit - d.quantitySold),
    isActive: d.isActive,
    archivedAt: d.archivedAt,
    state: dealState(d),
    product: product ? {
      id: product.id, name: product.name, slug: product.slug, sku: product.sku, thumbnail: product.thumbnailUrl,
      price: basePrice, stock: product.stock
    } : null,
    dealPrice: basePrice != null ? applyDiscount(basePrice, d.discountType, d.discountValue) : null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt
  };
}

export async function listDealsForAdmin({ includeArchived = false } = {}) {
  const rows = await db.select({ deal: flashDeals, product: products }).from(flashDeals)
    .innerJoin(products, eq(products.id, flashDeals.productId))
    .where(includeArchived ? undefined : isNull(flashDeals.archivedAt))
    .orderBy(desc(flashDeals.startsAt)).limit(500);
  return rows.map((r) => toApiDeal(r.deal, r.product));
}

// Storefront: live deals with full product cards.
export async function listLiveDeals(limit = 12) {
  const now = new Date();
  const rows = await db.select({ deal: flashDeals }).from(flashDeals)
    .innerJoin(products, eq(products.id, flashDeals.productId))
    .where(and(
      eq(flashDeals.isActive, true), isNull(flashDeals.archivedAt), eq(products.isActive, true),
      lte(flashDeals.startsAt, now), gt(flashDeals.endsAt, now),
      sql`(${flashDeals.quantityLimit} IS NULL OR ${flashDeals.quantitySold} < ${flashDeals.quantityLimit})`
    ))
    .orderBy(flashDeals.endsAt).limit(limit);
  const seen = new Set();
  const out = [];
  for (const { deal } of rows) {
    if (seen.has(deal.productId)) continue;
    seen.add(deal.productId);
    const product = await findProductByIdentifier(deal.productId);
    if (product) out.push({ ...toApiDeal(deal, null), dealPrice: product.flashDeal?.dealPrice ?? null, product });
  }
  return out;
}

export async function findDeal(id) {
  const [row] = await db.select().from(flashDeals).where(eq(flashDeals.id, id)).limit(1);
  return row || null;
}

export async function createDeal(data, createdBy) {
  const [row] = await db.insert(flashDeals).values({ ...data, createdBy }).returning();
  return row;
}

export async function updateDeal(id, patch) {
  const [row] = await db.update(flashDeals).set({ ...patch, updatedAt: new Date() }).where(eq(flashDeals.id, id)).returning();
  return row || null;
}

// Overlapping live windows on one product would make the price ambiguous.
export async function findOverlappingDeal({ productId, startsAt, endsAt, excludeId }) {
  const rows = await db.select().from(flashDeals).where(and(
    eq(flashDeals.productId, productId), eq(flashDeals.isActive, true), isNull(flashDeals.archivedAt),
    // Column helpers (not a raw sql`` fragment) so Drizzle converts the Dates:
    // the postgres-js driver is configured to pass timestamps through untouched
    // and throws on a raw Date parameter.
    lt(flashDeals.startsAt, endsAt), gt(flashDeals.endsAt, startsAt)
  ));
  return rows.find((r) => r.id !== excludeId) || null;
}
