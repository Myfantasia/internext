import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { isUuid } from '../db/util.js';
import { carts, cartItems, products, productVariants } from '../db/schema.js';
import { getLiveFlashDeals, priceLine } from '../services/pricing.js';

export class CartError extends Error {
  constructor(message, status = 400, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}

async function checkStock(productId, variantId, requestedQuantity) {
  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!product || !product.isActive) {
    throw new CartError('Product not found', 404);
  }
  let available = product.stock - product.reservedStock;
  if (variantId) {
    const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, variantId)).limit(1);
    if (!variant) throw new CartError('Product variant not found', 404);
    available = variant.stock;
  }
  if (available < requestedQuantity) {
    throw new CartError(`Only ${available} unit(s) of ${product.name} available`, 409, { available });
  }
}

async function getOrCreateCart(userId) {
  const [existing] = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(carts).values({ userId }).returning();
  return created;
}

// Reshapes to the exact frontend CartItem contract (src/types/index.ts),
// with live price/stock read from the product/variant — never trusts a
// stale client-side price.
async function toApiCart(cartId) {
  const rows = await db
    .select({ item: cartItems, product: products, variant: productVariants })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .leftJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .where(eq(cartItems.cartId, cartId));

  const deals = await getLiveFlashDeals(rows.map((r) => r.product.id));
  return rows.map(({ item, product, variant }) => {
    const deal = deals.get(product.id);
    const priced = priceLine(Number(variant?.price ?? product.price), deal);
    return {
      productId: product.id,
      variantId: variant?.id || null,
      name: product.name,
      variantName: variant?.name || null,
      sku: variant?.sku || product.sku,
      price: priced.unitPrice,
      compareAtPrice: deal ? priced.originalUnitPrice : (product.compareAtPrice ? Number(product.compareAtPrice) : null),
      flashDeal: deal ? { id: deal.id, title: deal.title, endsAt: deal.endsAt } : null,
      quantity: item.quantity,
      thumbnail: product.thumbnailUrl,
      stock: variant?.stock ?? Math.max(0, product.stock - product.reservedStock)
    };
  });
}

export async function getCart(userId) {
  const cart = await getOrCreateCart(userId);
  return toApiCart(cart.id);
}

function parseQuantity(quantity, { allowZero = false } = {}) {
  const q = Number(quantity);
  if (!Number.isInteger(q) || q < (allowZero ? 0 : 1) || q > 10000) throw new CartError('Quantity must be a whole number between 1 and 10,000.');
  return q;
}

export async function addCartItem(userId, { productId, variantId, quantity = 1 }) {
  if (!isUuid(productId) || (variantId && !isUuid(variantId))) throw new CartError('Product not found', 404);
  quantity = parseQuantity(quantity);
  const cart = await getOrCreateCart(userId);
  const condition = variantId
    ? and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, productId), eq(cartItems.variantId, variantId))
    : and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, productId), isNull(cartItems.variantId));

  const [existing] = await db.select().from(cartItems).where(condition).limit(1);
  const newQuantity = (existing?.quantity || 0) + quantity;
  await checkStock(productId, variantId, newQuantity);

  if (existing) {
    await db.update(cartItems).set({ quantity: newQuantity }).where(eq(cartItems.id, existing.id));
  } else {
    await db.insert(cartItems).values({ cartId: cart.id, productId, variantId: variantId || null, quantity });
  }
  return toApiCart(cart.id);
}

export async function updateCartItemQuantity(userId, { productId, variantId, quantity }) {
  if (!isUuid(productId) || (variantId && !isUuid(variantId))) throw new CartError('Product not found', 404);
  quantity = parseQuantity(quantity, { allowZero: true });
  const cart = await getOrCreateCart(userId);
  const condition = variantId
    ? and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, productId), eq(cartItems.variantId, variantId))
    : and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, productId), isNull(cartItems.variantId));

  if (quantity <= 0) {
    await db.delete(cartItems).where(condition);
  } else {
    await checkStock(productId, variantId, quantity);
    await db.update(cartItems).set({ quantity }).where(condition);
  }
  return toApiCart(cart.id);
}

export async function removeCartItem(userId, { productId, variantId }) {
  return updateCartItemQuantity(userId, { productId, variantId, quantity: 0 });
}

export async function clearCart(userId) {
  const cart = await getOrCreateCart(userId);
  await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
  return [];
}

// Merge-on-login: fold a guest (localStorage) cart into the user's DB cart.
// Clamps to available stock rather than failing the whole merge/login.
export async function mergeGuestCart(userId, guestItems) {
  const cart = await getOrCreateCart(userId);
  for (const item of guestItems || []) {
    try {
      const condition = item.variantId
        ? and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, item.productId), eq(cartItems.variantId, item.variantId))
        : and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, item.productId), isNull(cartItems.variantId));
      const [existing] = await db.select().from(cartItems).where(condition).limit(1);
      const desiredQuantity = (existing?.quantity || 0) + (item.quantity || 1);

      let available = desiredQuantity;
      try {
        await checkStock(item.productId, item.variantId, desiredQuantity);
      } catch (e) {
        if (e instanceof CartError && e.available !== undefined) available = Math.max(0, e.available);
        else throw e;
      }
      if (available <= 0) continue;

      if (existing) {
        await db.update(cartItems).set({ quantity: available }).where(eq(cartItems.id, existing.id));
      } else {
        await db.insert(cartItems).values({ cartId: cart.id, productId: item.productId, variantId: item.variantId || null, quantity: available });
      }
    } catch {
      // Skip items that no longer exist rather than failing the whole merge.
    }
  }
  return toApiCart(cart.id);
}
