import { and, eq, gt, inArray, isNull, lte, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { flashDeals } from '../db/schema.js';

// Single source of truth for "what does this item cost right now". The
// storefront, cart, and order pipeline all call this; nothing trusts a price
// sent by the browser.

export function roundMoney(amount) {
  return Math.round(Number(amount) * 100) / 100;
}

export function applyDiscount(basePrice, discountType, discountValue) {
  const base = Number(basePrice);
  const value = Number(discountValue);
  const discounted = discountType === 'percentage' ? base * (1 - Math.min(value, 100) / 100) : base - value;
  // Whole shillings: customers see and pay round KES amounts.
  return Math.max(0, Math.round(discounted));
}

function liveDealConditions(now) {
  return [
    eq(flashDeals.isActive, true),
    isNull(flashDeals.archivedAt),
    lte(flashDeals.startsAt, now),
    gt(flashDeals.endsAt, now),
    sql`(${flashDeals.quantityLimit} IS NULL OR ${flashDeals.quantitySold} < ${flashDeals.quantityLimit})`
  ];
}

// Returns Map<productId, deal> of deals live right now. If an admin scheduled
// overlapping deals for one product, the one ending soonest wins.
export async function getLiveFlashDeals(productIds, tx = db) {
  const ids = [...new Set((productIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const now = new Date();
  const rows = await tx.select().from(flashDeals)
    .where(and(inArray(flashDeals.productId, ids), ...liveDealConditions(now)))
    .orderBy(flashDeals.endsAt);
  const map = new Map();
  for (const row of rows) if (!map.has(row.productId)) map.set(row.productId, row);
  return map;
}

export async function listLiveFlashDealProductIds(limit = 24) {
  const now = new Date();
  const rows = await db.select({ productId: flashDeals.productId }).from(flashDeals)
    .where(and(...liveDealConditions(now)))
    .orderBy(flashDeals.endsAt)
    .limit(limit);
  return [...new Set(rows.map((r) => r.productId))];
}

// Public shape of a deal attached to a product in API responses.
export function toPublicDeal(deal, basePrice) {
  if (!deal) return null;
  const remaining = deal.quantityLimit == null ? null : Math.max(0, deal.quantityLimit - deal.quantitySold);
  return {
    id: deal.id,
    title: deal.title,
    description: deal.description,
    discountType: deal.discountType,
    discountValue: Number(deal.discountValue),
    dealPrice: applyDiscount(basePrice, deal.discountType, deal.discountValue),
    startsAt: deal.startsAt,
    endsAt: deal.endsAt,
    remaining
  };
}

// Prices a line given its catalog price and any live deal.
export function priceLine(basePrice, deal) {
  const original = Number(basePrice);
  if (!deal) return { unitPrice: original, originalUnitPrice: original, flashDealId: null };
  return { unitPrice: applyDiscount(original, deal.discountType, deal.discountValue), originalUnitPrice: original, flashDealId: deal.id };
}

// VAT breakdown for goods. When prices include VAT (the Kenyan retail norm),
// VAT is the inclusive portion; otherwise it is added on top.
export function computeTax(taxableAmount, taxRate, pricesIncludeTax) {
  const rate = Number(taxRate) || 0;
  if (rate <= 0) return { taxAmount: 0, totalGoods: taxableAmount };
  if (pricesIncludeTax) {
    return { taxAmount: roundMoney((taxableAmount * rate) / (100 + rate)), totalGoods: taxableAmount };
  }
  const taxAmount = roundMoney((taxableAmount * rate) / 100);
  return { taxAmount, totalGoods: roundMoney(taxableAmount + taxAmount) };
}
