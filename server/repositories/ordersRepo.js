import { eq, or, and, ilike, desc, asc, sql, inArray, lt, gt, gte, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  orders, orderItems, orderStatusHistory, products, productVariants, flashDeals, cartItems, carts, paymentAttempts, storeStock
} from '../db/schema.js';
import { createInvoiceForOrder } from './invoicesRepo.js';
import { createReceiptForPayment } from './receiptsRepo.js';
import { getCompanyProfile } from './companyProfileRepo.js';
import { isUuid } from '../db/util.js';
import { getLiveFlashDeals, priceLine, computeTax, roundMoney } from '../services/pricing.js';
import { quoteDelivery, getDeliveryConfig } from '../services/delivery.js';
import { evaluateCoupon, reserveCoupon, redeemCouponForOrder, releaseCouponForOrder } from '../services/coupons.js';

// Postgres errors on `uuid_col = $1` when $1 isn't a valid UUID, even in an
// unmatched OR branch — order numbers ("ORD-2026-000001") are the common
// case (public tracking), so this must never blindly OR against orders.id.
function orderIdentifierCondition(identifier) {
  return isUuid(identifier) ? or(eq(orders.id, identifier), eq(orders.orderNumber, identifier)) : eq(orders.orderNumber, identifier);
}

export class OrderError extends Error {
  constructor(message, status = 400, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}

// Server-side payment method registry. `key` is what the client sends;
// `label` is what is stored on the order and shown on receipts.
export const PAYMENT_METHODS = {
  mpesa: { label: 'M-Pesa STK Push', online: true },
  card: { label: 'Card (Visa / Mastercard)', online: true },
  bank_transfer: { label: 'Bank Transfer / RTGS', online: false },
  cash_on_delivery: { label: 'Cash on Delivery', online: false }
};
// Pay-on-delivery is limited to riders' local coverage (or store pickup).
export const CASH_ON_DELIVERY_MAX_KM = 40;
const ONLINE_PAYMENT_LABELS = Object.values(PAYMENT_METHODS).filter((m) => m.online).map((m) => m.label);

function orderNumberFor(seq) {
  const year = new Date().getFullYear();
  return `ORD-${year}-${String(seq).padStart(6, '0')}`;
}

function trackingNumberFor() {
  return `NEX-${Math.floor(100000 + Math.random() * 900000)}`;
}

// Reshapes DB rows into the JSON contract the frontend speaks (src/types/index.ts Order).
async function toApiOrder(orderRow, tx = db) {
  const [items, history, attempts] = await Promise.all([
    tx.select().from(orderItems).where(eq(orderItems.orderId, orderRow.id)),
    tx.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, orderRow.id)).orderBy(orderStatusHistory.createdAt),
    tx.select().from(paymentAttempts).where(eq(paymentAttempts.orderId, orderRow.id)).orderBy(desc(paymentAttempts.createdAt)).limit(1)
  ]);
  const latest = attempts[0];

  return {
    id: orderRow.id,
    orderNumber: orderRow.orderNumber,
    customer: { name: orderRow.customerName, email: orderRow.customerEmail, phone: orderRow.customerPhone },
    items: items.map((it) => ({
      productId: it.productId,
      variantId: it.variantId,
      name: it.name,
      variantName: it.variantName,
      sku: it.sku,
      shortDescription: it.shortDescription,
      price: Number(it.unitPrice),
      originalPrice: it.originalUnitPrice != null ? Number(it.originalUnitPrice) : Number(it.unitPrice),
      flashDealId: it.flashDealId,
      quantity: it.quantity,
      thumbnail: it.thumbnailUrl
    })),
    subtotal: Number(orderRow.subtotal),
    discountAmount: Number(orderRow.discountAmount),
    couponCode: orderRow.couponCode,
    flashDealSavings: Number(orderRow.flashDealSavings || 0),
    deliveryFee: Number(orderRow.deliveryFee),
    taxAmount: Number(orderRow.taxAmount),
    taxRate: Number(orderRow.taxRate),
    total: Number(orderRow.total),
    currency: orderRow.currency,
    status: orderRow.status,
    paymentStatus: orderRow.paymentStatus,
    paymentMethod: orderRow.paymentMethod,
    paymentReference: orderRow.paymentReference,
    paidAt: orderRow.paidAt,
    latestPayment: latest ? {
      id: latest.id, provider: latest.provider, status: latest.status, reference: latest.providerReference,
      failureReason: latest.failureReason, createdAt: latest.createdAt
    } : null,
    deliveryMethod: orderRow.deliveryMethod,
    deliveryAddress: orderRow.deliveryAddress,
    deliveryQuote: orderRow.deliveryQuote,
    deliveryDistanceKm: orderRow.deliveryDistanceKm != null ? Number(orderRow.deliveryDistanceKm) : null,
    trackingNumber: orderRow.trackingNumber,
    timeline: history.map((h) => ({ status: h.status, timestamp: h.createdAt, note: h.note })),
    createdAt: orderRow.createdAt,
    userId: orderRow.userId
  };
}

// Ownership is by account, not by the (editable) contact email on the order.
// Orders from before user linking fall back to the account email.
export function canAccessOrder(user, order) {
  if (!user) return false;
  if (user.role === 'ADMIN' || user.role === 'SALES_MANAGER') return true;
  if (order.userId) return order.userId === user.id;
  // Unlinked (legacy/guest) orders: only with a verified email, so changing or
  // registering an address you don't own reveals nothing.
  return !!user.emailVerified && !!order.customer?.email && order.customer.email.toLowerCase() === user.email.toLowerCase();
}

// ---------------------------------------------------------------------------
// Checkout preview + order creation share one pricing routine.
// ---------------------------------------------------------------------------

async function loadCartLines(tx, userId) {
  const rows = await tx
    .select({ item: cartItems, product: products, variant: productVariants })
    .from(cartItems)
    .innerJoin(carts, eq(carts.id, cartItems.cartId))
    .innerJoin(products, eq(cartItems.productId, products.id))
    .leftJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .where(eq(carts.userId, userId));
  return rows;
}

// Computes every money figure for the signed-in user's current cart.
// Used read-only for the checkout summary and, inside the order transaction
// (with locks), for the order itself — so the two can never disagree.
export async function priceCart(tx, { userId, couponCode, delivery, lockCoupon = false }) {
  const rows = await loadCartLines(tx, userId);
  return priceLines(tx, { rows, userId, couponCode, delivery, lockCoupon });
}

export async function priceLines(tx, { rows, userId, couponCode, delivery, lockCoupon = false, isPos = false }) {
  if (!rows.length) throw new OrderError('No items to price.', 400, { code: 'CART_EMPTY' });

  const deals = await getLiveFlashDeals(rows.map((r) => r.product.id), tx);
  const lines = [];
  let subtotal = 0;
  let flashDealSavings = 0;

  for (const { item, product, variant } of rows) {
    if (!product.isActive) throw new OrderError(`${product.name} is no longer available. Please remove it from your cart.`, 409, { productId: product.id });
    const basePrice = variant ? Number(variant.price) : Number(product.price);
    const priced = priceLine(basePrice, deals.get(product.id));
    const lineTotal = priced.unitPrice * item.quantity;
    subtotal += lineTotal;
    flashDealSavings += (priced.originalUnitPrice - priced.unitPrice) * item.quantity;
    lines.push({
      productId: product.id,
      categoryId: product.categoryId,
      variantId: variant?.id || null,
      name: product.name,
      variantName: variant?.name || null,
      sku: variant?.sku || product.sku,
      shortDescription: product.shortSpecs,
      thumbnailUrl: product.thumbnailUrl,
      quantity: item.quantity,
      available: variant ? variant.stock : product.stock - product.reservedStock,
      unitCost: product.costPrice != null ? Number(product.costPrice) : null,
      lineTotal,
      hasFlashDeal: !!priced.flashDealId,
      ...priced
    });
  }
  subtotal = roundMoney(subtotal);

  let discountAmount = 0;
  let coupon = null;
  let couponError = null;
  if (couponCode) {
    try {
      const evaluated = await evaluateCoupon(tx, { code: couponCode, userId, lines, lock: lockCoupon });
      coupon = evaluated.coupon;
      discountAmount = evaluated.discount;
    } catch (err) {
      if (lockCoupon) throw new OrderError(err.message, 400, { code: 'COUPON_INVALID' });
      couponError = err.message;
    }
  }

  let deliveryQuote = null;
  let deliveryError = null;
  if (delivery) {
    try {
      deliveryQuote = await quoteDelivery(delivery, subtotal - discountAmount, await getDeliveryConfig({ database: tx }));
    } catch (err) {
      if (!err.code) throw err;
      deliveryError = { message: err.message, code: err.code };
    }
  } else if (isPos) {
    deliveryQuote = { mode: 'option', kind: 'pickup', label: 'In-Store POS', fee: 0 };
  }

  const profile = await getCompanyProfile(tx);
  const taxRate = Number(profile?.taxRate ?? 16);
  const pricesIncludeTax = profile?.pricesIncludeTax ?? true;
  const taxable = Math.max(0, roundMoney(subtotal - discountAmount));
  const { taxAmount, totalGoods } = computeTax(taxable, taxRate, pricesIncludeTax);
  const deliveryFee = deliveryQuote ? deliveryQuote.fee : 0;

  return {
    lines,
    subtotal,
    flashDealSavings: roundMoney(flashDealSavings),
    discountAmount,
    coupon,
    couponError,
    deliveryQuote,
    deliveryError,
    deliveryFee,
    taxRate,
    pricesIncludeTax,
    taxAmount,
    total: roundMoney(totalGoods + deliveryFee)
  };
}

// Pay on delivery is only offered where it can be relied on: a value cap set in
// Settings, and one open pay-on-delivery order per customer at a time.
async function cashOnDeliveryProblem(tx, { userId, total }) {
  const company = await getCompanyProfile(tx);
  const cap = company?.codMaxOrderAmount != null ? Number(company.codMaxOrderAmount) : null;
  if (cap && total > cap) {
    return `Pay on delivery is available for orders up to KES ${cap.toLocaleString('en-KE')}. Please pay by M-Pesa, card or bank transfer.`;
  }
  const [open] = await tx.select({ orderNumber: orders.orderNumber }).from(orders).where(and(
    eq(orders.userId, userId),
    eq(orders.paymentMethod, PAYMENT_METHODS.cash_on_delivery.label),
    eq(orders.paymentStatus, 'Pending (Cash On Delivery)'),
    inArray(orders.status, ['Pending', 'Processing', 'Packed', 'Dispatched', 'Out for Delivery'])
  )).limit(1);
  if (open) {
    return `You already have a pay-on-delivery order (${open.orderNumber}) in progress. Please pay for this one by M-Pesa, card or bank transfer, or wait until that delivery is complete.`;
  }
  return null;
}

export async function createOrder({ userId, customer, couponCode, delivery, address, paymentMethodKey }) {
  const method = PAYMENT_METHODS[paymentMethodKey];
  if (!method) throw new OrderError('Choose a valid payment method.');

  return db.transaction(async (tx) => {
    const priced = await priceCart(tx, { userId, couponCode, delivery, lockCoupon: true });
    if (priced.deliveryError) throw new OrderError(priced.deliveryError.message, 400, { code: priced.deliveryError.code });
    if (!priced.deliveryQuote) throw new OrderError('Choose a delivery option.', 400, { code: 'DELIVERY_REQUIRED' });

    const quote = priced.deliveryQuote;
    if (paymentMethodKey === 'cash_on_delivery') {
      const local = quote.mode === 'option' ? quote.kind === 'pickup' : quote.distanceKm != null && quote.distanceKm <= CASH_ON_DELIVERY_MAX_KM && !quote.estimated;
      if (!local) {
        throw new OrderError(`Pay on delivery is available for store pickup or pinned addresses within ${CASH_ON_DELIVERY_MAX_KM} km. Please choose another payment method.`, 400, { code: 'COD_UNAVAILABLE' });
      }
      const problem = await cashOnDeliveryProblem(tx, { userId, total: priced.total });
      if (problem) throw new OrderError(problem, 400, { code: 'COD_UNAVAILABLE' });
    }

    // Atomic stock holds: the WHERE clause refuses to over-reserve, so two
    // buyers racing for the last unit can't both succeed.
    for (const line of priced.lines) {
      // Variants have no reservation column: lock the row and check stock;
      // the decrement happens at payment confirmation.
      const held = line.variantId
        ? await tx.select({ id: productVariants.id }).from(productVariants)
          .where(and(eq(productVariants.id, line.variantId), sql`${productVariants.stock} >= ${line.quantity}`)).for('update')
        : await tx.update(products).set({ reservedStock: sql`${products.reservedStock} + ${line.quantity}` })
          .where(and(eq(products.id, line.productId), sql`${products.stock} - ${products.reservedStock} >= ${line.quantity}`)).returning({ id: products.id });
      if (!held.length) {
        throw new OrderError(`Insufficient stock for ${line.name}. Only ${Math.max(0, line.available)} available.`, 409, {
          productId: line.productId, available: Math.max(0, line.available), code: 'OUT_OF_STOCK'
        });
      }
      if (line.flashDealId) {
        const dealHeld = await tx.update(flashDeals).set({ quantitySold: sql`${flashDeals.quantitySold} + ${line.quantity}` })
          .where(and(eq(flashDeals.id, line.flashDealId), sql`(${flashDeals.quantityLimit} IS NULL OR ${flashDeals.quantitySold} + ${line.quantity} <= ${flashDeals.quantityLimit})`))
          .returning({ id: flashDeals.id });
        if (!dealHeld.length) throw new OrderError(`The flash deal on ${line.name} has sold out. Please refresh your cart.`, 409, { code: 'DEAL_SOLD_OUT' });
      }
    }

    const [{ seq }] = await tx.execute(sql`select nextval('order_number_seq')::bigint as seq`);
    const orderNumber = orderNumberFor(seq);
    const deliveryAddress = quote.kind === 'pickup'
      ? { pickup: true, notes: address?.notes || '' }
      : {
        county: address?.county, town: address?.town, street: address?.street, building: address?.building || '',
        deliveryNotes: address?.notes || '', lat: address?.lat ?? null, lng: address?.lng ?? null
      };

    const [order] = await tx.insert(orders).values({
      orderNumber,
      userId,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      subtotal: String(priced.subtotal),
      discountAmount: String(priced.discountAmount),
      couponCode: priced.coupon?.code || null,
      flashDealSavings: String(priced.flashDealSavings),
      deliveryFee: String(priced.deliveryFee),
      taxAmount: String(priced.taxAmount),
      taxRate: String(priced.taxRate),
      total: String(priced.total),
      // Only pay-on-delivery orders go straight to the warehouse; everything
      // else (including bank transfer) waits for the money.
      status: paymentMethodKey === 'cash_on_delivery' ? 'Processing' : 'Payment Pending',
      paymentStatus: paymentMethodKey === 'cash_on_delivery' ? 'Pending (Cash On Delivery)' : 'Pending',
      paymentMethod: method.label,
      deliveryMethod: quote.label,
      deliveryAddress,
      deliveryQuote: quote,
      deliveryDistanceKm: quote.distanceKm != null ? String(quote.distanceKm) : null,
      trackingNumber: trackingNumberFor()
    }).returning();

    for (const line of priced.lines) {
      await tx.insert(orderItems).values({
        orderId: order.id,
        productId: line.productId,
        variantId: line.variantId,
        name: line.name,
        variantName: line.variantName,
        sku: line.sku,
        shortDescription: line.shortDescription,
        unitPrice: String(line.unitPrice),
        originalUnitPrice: String(line.originalUnitPrice),
        unitCost: line.unitCost != null ? String(line.unitCost) : null,
        flashDealId: line.flashDealId,
        quantity: line.quantity,
        thumbnailUrl: line.thumbnailUrl
      });
    }

    if (priced.coupon) {
      await reserveCoupon(tx, { couponId: priced.coupon.id, userId, orderId: order.id, discountAmount: priced.discountAmount });
    }

    await tx.insert(orderStatusHistory).values({ orderId: order.id, status: 'Order Placed', note: `Order ${orderNumber} placed via web portal.` });
    await createInvoiceForOrder(tx, order);

    // The cart has become an order.
    const [cart] = await tx.select({ id: carts.id }).from(carts).where(eq(carts.userId, userId)).limit(1);
    if (cart) await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id));

    return toApiOrder(order, tx);
  });
}

export async function createPosOrder({ userId, customer, couponCode, items, storeId, servedBy, paymentMethod, amountPaid }) {
  if (!storeId) throw new OrderError('Store ID is required for POS transactions.', 400);
  
  return db.transaction(async (tx) => {
    // 1. Convert simple item lines into the 'rows' format expected by priceLines
    const rows = [];
    for (const item of items) {
      const [product] = await tx.select().from(products).where(eq(products.id, item.productId));
      if (!product) throw new OrderError(`Product ${item.productId} not found.`, 404);
      let variant = null;
      if (item.variantId) {
        [variant] = await tx.select().from(productVariants).where(eq(productVariants.id, item.variantId));
        if (!variant) throw new OrderError(`Variant ${item.variantId} not found.`, 404);
      }
      rows.push({ item, product, variant });
    }

    const priced = await priceLines(tx, { rows, userId, couponCode, lockCoupon: true, isPos: true });
    
    // 2. Stock validation & deduction
    for (const line of priced.lines) {
      // Branch-level stock
      const branchStockRows = await tx.select().from(storeStock)
        .where(and(
          eq(storeStock.storeId, storeId),
          eq(storeStock.productId, line.productId),
          line.variantId ? eq(storeStock.variantId, line.variantId) : sql`${storeStock.variantId} IS NULL`,
          sql`${storeStock.stock} >= ${line.quantity}`
        )).for('update');
      
      if (!branchStockRows.length) {
        throw new OrderError(`Insufficient stock at this branch for ${line.name}.`, 409, { code: 'OUT_OF_STOCK_BRANCH', productId: line.productId });
      }

      await tx.update(storeStock)
        .set({ stock: sql`${storeStock.stock} - ${line.quantity}`, updatedAt: new Date() })
        .where(eq(storeStock.id, branchStockRows[0].id));

      // Global stock
      if (line.variantId) {
        await tx.update(productVariants)
          .set({ stock: sql`GREATEST(0, ${productVariants.stock} - ${line.quantity})` })
          .where(eq(productVariants.id, line.variantId));
      } else {
        await tx.update(products)
          .set({ stock: sql`GREATEST(0, ${products.stock} - ${line.quantity})` })
          .where(eq(products.id, line.productId));
      }

      if (line.flashDealId) {
        await tx.update(flashDeals).set({ quantitySold: sql`${flashDeals.quantitySold} + ${line.quantity}` })
          .where(eq(flashDeals.id, line.flashDealId));
      }
    }

    // 3. Order Creation
    const [{ seq }] = await tx.execute(sql`select nextval('order_number_seq')::bigint as seq`);
    const orderNumber = orderNumberFor(seq);
    const quote = priced.deliveryQuote;

    // Pos sales are typically paid immediately. We assume fully paid if amountPaid >= total
    const isFullyPaid = Number(amountPaid) >= priced.total;
    const finalStatus = isFullyPaid ? 'Delivered' : 'Pending';
    const finalPaymentStatus = isFullyPaid ? 'Paid' : 'Pending';

    const [order] = await tx.insert(orders).values({
      orderNumber,
      userId: userId || null,
      salesChannel: 'pos',
      storeId,
      servedBy,
      customerName: customer?.name || 'Walk-in Customer',
      customerEmail: customer?.email || '',
      customerPhone: customer?.phone || '',
      subtotal: String(priced.subtotal),
      discountAmount: String(priced.discountAmount),
      couponCode: priced.coupon?.code || null,
      flashDealSavings: String(priced.flashDealSavings),
      deliveryFee: String(priced.deliveryFee),
      taxAmount: String(priced.taxAmount),
      taxRate: String(priced.taxRate),
      total: String(priced.total),
      amountPaid: String(amountPaid),
      status: finalStatus,
      paymentStatus: finalPaymentStatus,
      paymentMethod,
      deliveryMethod: quote.label,
      deliveryAddress: { pickup: true, notes: 'POS Walk-in' },
      deliveryQuote: quote,
      trackingNumber: trackingNumberFor(),
      paidAt: isFullyPaid ? new Date() : null
    }).returning();

    for (const line of priced.lines) {
      await tx.insert(orderItems).values({
        orderId: order.id,
        productId: line.productId,
        variantId: line.variantId,
        name: line.name,
        variantName: line.variantName,
        sku: line.sku,
        shortDescription: line.shortDescription,
        unitPrice: String(line.unitPrice),
        originalUnitPrice: String(line.originalUnitPrice),
        unitCost: line.unitCost != null ? String(line.unitCost) : null,
        flashDealId: line.flashDealId,
        quantity: line.quantity,
        thumbnailUrl: line.thumbnailUrl
      });
    }

    if (priced.coupon) {
      // In POS, if paid, we redeem it directly.
      if (isFullyPaid) {
        await reserveCoupon(tx, { couponId: priced.coupon.id, userId, orderId: order.id, discountAmount: priced.discountAmount });
        await redeemCouponForOrder(tx, order.id);
      } else {
        await reserveCoupon(tx, { couponId: priced.coupon.id, userId, orderId: order.id, discountAmount: priced.discountAmount });
      }
    }

    await tx.insert(orderStatusHistory).values({ orderId: order.id, status: 'Order Placed', note: `POS Order ${orderNumber} created.`, changedBy: servedBy });
    if (isFullyPaid) {
      await tx.insert(orderStatusHistory).values({ orderId: order.id, status: 'Payment Confirmed', note: `Payment of KES ${Number(amountPaid).toLocaleString('en-KE')} collected via ${paymentMethod}.`, changedBy: servedBy });
    }

    // Generate Invoice/Receipt
    await createInvoiceForOrder(tx, order);
    let receipt = null;
    if (isFullyPaid) {
      const res = await createReceiptForPayment(tx, order, {
        amount: String(amountPaid),
        paymentMethod,
        provider: 'pos',
        providerReference: `POS-${orderNumber}`
      });
      receipt = res.receipt;
    }

    const apiOrder = await toApiOrder(order, tx);
    return { order: apiOrder, receipt };
  });
}

export async function findOrderByIdentifier(identifier) {
  const [row] = await db.select().from(orders).where(orderIdentifierCondition(identifier)).limit(1);
  if (!row) return null;
  return toApiOrder(row);
}

export async function findOrderByPaymentReference(reference) {
  const [row] = await db.select({ id: orders.id }).from(orders).where(eq(orders.paymentReference, reference)).limit(1);
  return row || null;
}

export async function findOrdersForUser(user) {
  const byAccount = eq(orders.userId, user.id);
  const rows = await db.select().from(orders)
    .where(user.emailVerified ? or(byAccount, and(sql`${orders.userId} IS NULL`, ilike(orders.customerEmail, user.email))) : byAccount)
    .orderBy(desc(orders.createdAt)).limit(200);
  return Promise.all(rows.map((r) => toApiOrder(r)));
}

export async function findOrdersForCustomerOrPhone(query) {
  const digits = query.replace(/\D/g, '');
  const isPhoneQuery = digits.length >= 7;
  const conditions = [ilike(orders.customerEmail, query)];
  if (isPhoneQuery) {
    conditions.push(sql`regexp_replace(${orders.customerPhone}, '\\D', '', 'g') LIKE ${'%' + digits + '%'}`);
  }
  const rows = await db.select().from(orders).where(or(...conditions)).orderBy(desc(orders.createdAt)).limit(200);
  return Promise.all(rows.map((r) => toApiOrder(r)));
}

// Staff orders table: one page at a time, filtered and sorted in SQL. Items and
// the latest payment attempt are loaded for the whole page in two queries
// (no per-order round trips); the timeline is left for the order detail view.
export async function listOrdersPage({ status, paymentStatus, paymentMethod, search, from, to, sort = 'newest', page = 1, limit = 25 } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(Math.max(5, parseInt(limit, 10) || 25), 100);
  const conditions = [];
  if (paymentStatus) conditions.push(eq(orders.paymentStatus, paymentStatus));
  if (paymentMethod) conditions.push(eq(orders.paymentMethod, String(paymentMethod).slice(0, 60)));
  if (search) {
    const q = `%${String(search).trim().slice(0, 100).replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const digits = String(search).replace(/\D/g, '');
    conditions.push(or(
      ilike(orders.orderNumber, q), ilike(orders.customerName, q), ilike(orders.customerEmail, q), ilike(orders.paymentReference, q),
      ...(digits.length >= 4 ? [sql`regexp_replace(coalesce(${orders.customerPhone}, ''), '\\D', '', 'g') LIKE ${'%' + (digits.startsWith('0') ? digits.slice(1) : digits) + '%'}`] : [])
    ));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(from || '')) conditions.push(gte(orders.createdAt, new Date(`${from}T00:00:00+03:00`)));
  if (/^\d{4}-\d{2}-\d{2}$/.test(to || '')) conditions.push(lte(orders.createdAt, new Date(`${to}T23:59:59.999+03:00`)));
  const base = conditions.length ? and(...conditions) : undefined;
  const where = status ? and(base, eq(orders.status, status)) : base;
  const orderBy = {
    newest: [desc(orders.createdAt)], oldest: [asc(orders.createdAt)],
    'total-desc': [desc(orders.total)], 'total-asc': [asc(orders.total)]
  }[sort] || [desc(orders.createdAt)];

  const [rows, [{ total }], statusCounts] = await Promise.all([
    db.select().from(orders).where(where).orderBy(...orderBy, desc(orders.id)).limit(limitNum).offset((pageNum - 1) * limitNum),
    db.select({ total: sql`count(*)::int` }).from(orders).where(where),
    // Tab counts ignore the status tab itself so every tab shows its number.
    db.select({ status: orders.status, n: sql`count(*)::int` }).from(orders).where(base).groupBy(orders.status)
  ]);

  const ids = rows.map((r) => r.id);
  const [items, attempts] = ids.length ? await Promise.all([
    db.select().from(orderItems).where(inArray(orderItems.orderId, ids)),
    db.execute(sql`select distinct on (${paymentAttempts.orderId}) * from ${paymentAttempts} where ${inArray(paymentAttempts.orderId, ids)} order by ${paymentAttempts.orderId}, ${paymentAttempts.createdAt} desc`)
  ]) : [[], []];
  const itemsBy = new Map();
  for (const it of items) (itemsBy.get(it.orderId) || itemsBy.set(it.orderId, []).get(it.orderId)).push(it);
  const attemptBy = new Map([...attempts].map((a) => [a.order_id, a]));

  return {
    orders: rows.map((o) => {
      const latest = attemptBy.get(o.id);
      return {
        id: o.id, orderNumber: o.orderNumber, userId: o.userId,
        customer: { name: o.customerName, email: o.customerEmail, phone: o.customerPhone },
        items: (itemsBy.get(o.id) || []).map((it) => ({
          productId: it.productId, variantId: it.variantId, name: it.name, variantName: it.variantName, sku: it.sku,
          shortDescription: it.shortDescription, price: Number(it.unitPrice),
          originalPrice: it.originalUnitPrice != null ? Number(it.originalUnitPrice) : Number(it.unitPrice),
          flashDealId: it.flashDealId, quantity: it.quantity, thumbnail: it.thumbnailUrl
        })),
        subtotal: Number(o.subtotal), discountAmount: Number(o.discountAmount), couponCode: o.couponCode,
        flashDealSavings: Number(o.flashDealSavings || 0), deliveryFee: Number(o.deliveryFee), taxAmount: Number(o.taxAmount),
        taxRate: Number(o.taxRate), total: Number(o.total), currency: o.currency, status: o.status, paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod, paymentReference: o.paymentReference, paidAt: o.paidAt,
        latestPayment: latest ? { id: latest.id, provider: latest.provider, status: latest.status, reference: latest.provider_reference, failureReason: latest.failure_reason, createdAt: latest.created_at } : null,
        deliveryMethod: o.deliveryMethod, deliveryAddress: o.deliveryAddress, deliveryQuote: o.deliveryQuote,
        deliveryDistanceKm: o.deliveryDistanceKm != null ? Number(o.deliveryDistanceKm) : null,
        trackingNumber: o.trackingNumber, timeline: [], createdAt: o.createdAt
      };
    }),
    total, page: pageNum, limit: limitNum, totalPages: Math.max(1, Math.ceil(total / limitNum)),
    statusCounts: Object.fromEntries(statusCounts.map((r) => [r.status, r.n]))
  };
}

async function lockOrder(tx, identifier) {
  const [order] = await tx.select().from(orders).where(orderIdentifierCondition(identifier)).limit(1).for('update');
  return order || null;
}

// Gives back everything an unpaid order was holding: reserved stock, flash-deal
// quantity, and the coupon use.
async function releaseOrderHolds(tx, order) {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  for (const item of items) {
    if (!item.variantId) {
      await tx.update(products).set({ reservedStock: sql`GREATEST(0, ${products.reservedStock} - ${item.quantity})` }).where(eq(products.id, item.productId));
    }
    if (item.flashDealId) {
      await tx.update(flashDeals).set({ quantitySold: sql`GREATEST(0, ${flashDeals.quantitySold} - ${item.quantity})` }).where(eq(flashDeals.id, item.flashDealId));
    }
  }
  await releaseCouponForOrder(tx, order.id);
}

export async function updateOrderStatus(identifier, { status, note, trackingNumber, paymentStatus, changedByUserId }) {
  // Marking an order Paid must run the full confirmation (stock commit,
  // receipt, coupon redemption) — never just flip the flag.
  if (paymentStatus === 'Paid') {
    const existing = await findOrderByIdentifier(identifier);
    if (!existing) return null;
    if (existing.paymentStatus !== 'Paid') {
      await confirmOrderPayment(existing.id, { provider: 'manual', paymentReference: note ? `Manual: ${note.slice(0, 60)}` : 'Manual confirmation', changedByUserId });
    }
    paymentStatus = undefined;
  }

  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, identifier);
    if (!order) return null;

    const oldStatus = order.status;
    const patch = { updatedAt: new Date() };
    if (status) patch.status = status;
    if (paymentStatus) patch.paymentStatus = paymentStatus;
    if (trackingNumber) patch.trackingNumber = String(trackingNumber).slice(0, 60);

    if (status === 'Cancelled' && oldStatus !== 'Cancelled' && order.paymentStatus !== 'Paid') {
      await releaseOrderHolds(tx, order);
      if (!paymentStatus) patch.paymentStatus = 'Cancelled';
    }

    const [updated] = await tx.update(orders).set(patch).where(eq(orders.id, order.id)).returning();
    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      status: status || oldStatus,
      note: note || `Status updated to ${status || oldStatus} by staff`,
      changedBy: changedByUserId || null
    });

    return { order: await toApiOrder(updated, tx), oldStatus };
  });
}

// Customer-initiated cancellation of an unpaid order.
export async function cancelUnpaidOrder(orderId, { changedByUserId, note }) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order) return null;
    if (order.paymentStatus === 'Paid' || !['Pending', 'Payment Pending', 'Processing'].includes(order.status)) {
      throw new OrderError('This order can no longer be cancelled online. Please contact support.', 409);
    }
    await releaseOrderHolds(tx, order);
    const [updated] = await tx.update(orders).set({ status: 'Cancelled', paymentStatus: 'Cancelled', updatedAt: new Date() })
      .where(eq(orders.id, order.id)).returning();
    await tx.insert(orderStatusHistory).values({ orderId: order.id, status: 'Cancelled', note: note || 'Cancelled by customer before payment.', changedBy: changedByUserId || null });
    return toApiOrder(updated, tx);
  });
}

// Idempotent payment confirmation. The order row is locked, and an order that
// is already Paid is returned unchanged — so duplicate webhooks/callbacks or a
// double click can never decrement stock twice or issue two receipts.
export async function confirmOrderPayment(identifier, { paymentReference, provider = 'manual', amount, rawPayload, changedByUserId } = {}) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, identifier);
    if (!order) return null;
    if (order.paymentStatus === 'Paid') return { order: await toApiOrder(order, tx), receipt: null, alreadyPaid: true };

    if (amount != null && roundMoney(amount) < roundMoney(order.total)) {
      throw new OrderError(`Payment amount ${amount} is less than the order total ${order.total}.`, 409, { code: 'AMOUNT_MISMATCH' });
    }

    const wasCancelled = order.status === 'Cancelled';
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    for (const item of items) {
      if (item.variantId) {
        await tx.update(productVariants).set({ stock: sql`GREATEST(0, ${productVariants.stock} - ${item.quantity})` }).where(eq(productVariants.id, item.variantId));
      } else {
        await tx.update(products).set({
          stock: sql`GREATEST(0, ${products.stock} - ${item.quantity})`,
          // A cancelled order already released its reservation.
          reservedStock: wasCancelled ? sql`${products.reservedStock}` : sql`GREATEST(0, ${products.reservedStock} - ${item.quantity})`
        }).where(eq(products.id, item.productId));
      }
    }
    await redeemCouponForOrder(tx, order.id);

    const [updated] = await tx.update(orders).set({
      paymentStatus: 'Paid',
      // Money arriving for a cancelled order is recorded but needs a human
      // decision (refund or reinstate), so the order stays Cancelled.
      status: wasCancelled ? 'Cancelled' : (['Pending', 'Payment Pending'].includes(order.status) ? 'Processing' : order.status),
      paymentReference: paymentReference || order.paymentReference,
      paidAt: new Date(),
      updatedAt: new Date()
    }).where(eq(orders.id, order.id)).returning();

    const { receipt } = await createReceiptForPayment(tx, updated, {
      amount: updated.total,
      paymentMethod: updated.paymentMethod,
      provider,
      providerReference: paymentReference,
      rawPayload
    });

    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      status: 'Payment Confirmed',
      note: `Payment of KES ${Number(updated.total).toLocaleString('en-KE')} confirmed via ${provider}. Receipt: ${receipt.receiptNumber}${paymentReference ? ` (Ref: ${paymentReference})` : ''}${wasCancelled ? ' — order was cancelled: review for refund.' : ''}`,
      changedBy: changedByUserId || null
    });

    return { order: await toApiOrder(updated, tx), receipt, alreadyPaid: false };
  });
}

// Records a failed/cancelled online payment attempt on the order without
// cancelling it, so the customer can retry with the same or another method.
export async function markOrderPaymentFailed(orderId, { status, reason }) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order || order.paymentStatus === 'Paid' || order.status === 'Cancelled') return null;
    await tx.update(orders).set({ paymentStatus: status === 'cancelled' ? 'Cancelled' : 'Failed', updatedAt: new Date() }).where(eq(orders.id, order.id));
    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      status: status === 'cancelled' ? 'Payment Cancelled' : 'Payment Failed',
      note: reason ? String(reason).slice(0, 300) : null
    });
    return true;
  });
}

export async function markOrderRefunded(identifier, { reference, note, restock = false, amount, changedByUserId }) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, identifier);
    if (!order || order.paymentStatus === 'Refunded') return null;
    
    // Determine the refund amount. Defaults to the full amount paid, or order total if not set.
    const refundAmount = amount != null ? Number(amount) : Number(order.amountPaid || order.total);
    const newAmountPaid = Math.max(0, Number(order.amountPaid) - refundAmount);

    if (restock) {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      for (const item of items) {
        if (order.storeId) {
          // Restore branch stock
          const branchStockRows = await tx.select().from(storeStock)
            .where(and(
              eq(storeStock.storeId, order.storeId),
              eq(storeStock.productId, item.productId),
              item.variantId ? eq(storeStock.variantId, item.variantId) : sql`${storeStock.variantId} IS NULL`
            )).for('update');
          if (branchStockRows.length) {
            await tx.update(storeStock).set({ stock: sql`${storeStock.stock} + ${item.quantity}`, updatedAt: new Date() })
              .where(eq(storeStock.id, branchStockRows[0].id));
          } else {
            // It could be missing if it was manually deleted, so we recreate it
            await tx.insert(storeStock).values({
              storeId: order.storeId, productId: item.productId, variantId: item.variantId, stock: item.quantity
            });
          }
        }
        
        // Restore global stock
        if (item.variantId) {
          await tx.update(productVariants).set({ stock: sql`${productVariants.stock} + ${item.quantity}` }).where(eq(productVariants.id, item.variantId));
        } else {
          await tx.update(products).set({ stock: sql`${products.stock} + ${item.quantity}` }).where(eq(products.id, item.productId));
        }
      }
    }

    // A full refund sets status to Refunded, partial might just lower amountPaid and leave it Delivered/Processing.
    const isFullRefund = newAmountPaid === 0;
    const newPaymentStatus = isFullRefund ? 'Refunded' : 'Partially Refunded';
    const newStatus = isFullRefund ? 'Refunded' : order.status;

    await tx.update(orders).set({
      paymentStatus: newPaymentStatus,
      status: newStatus,
      amountPaid: String(newAmountPaid),
      updatedAt: new Date()
    }).where(eq(orders.id, order.id));

    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      status: newStatus,
      note: note || `Refund of KES ${refundAmount} processed${reference ? ` (Ref: ${reference})` : ''}.${restock ? ' Items restocked.' : ''}`,
      changedBy: changedByUserId || null
    });

    return await toApiOrder(await lockOrder(tx, identifier), tx);
  });
}

// Unpaid online-payment orders hold stock; give it back after a grace period.
export async function expireStaleUnpaidOrders({ olderThanMinutes = 120 } = {}) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  const stale = await db.select({ id: orders.id }).from(orders).where(and(
    eq(orders.status, 'Payment Pending'),
    inArray(orders.paymentStatus, ['Pending', 'Failed', 'Cancelled']),
    inArray(orders.paymentMethod, ONLINE_PAYMENT_LABELS),
    lt(orders.createdAt, cutoff)
  )).limit(100);

  let expired = 0;
  for (const { id } of stale) {
    const pending = await db.select({ id: paymentAttempts.id }).from(paymentAttempts)
      .where(and(eq(paymentAttempts.orderId, id), eq(paymentAttempts.status, 'pending'), gt(paymentAttempts.createdAt, new Date(Date.now() - 30 * 60 * 1000)))).limit(1);
    if (pending.length) continue; // a payment is still in flight
    try {
      await cancelUnpaidOrder(id, { note: `Automatically cancelled: no payment received within ${olderThanMinutes} minutes.` });
      expired += 1;
    } catch {
      // status changed concurrently — skip
    }
  }
  return expired;
}

export { toApiOrder };
