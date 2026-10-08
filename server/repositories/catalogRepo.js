import { eq, and, ilike, gte, lt, lte, inArray, desc, asc, sql, or } from 'drizzle-orm';
import { db } from '../db/client.js';
import { categories, brands, products, productVariants, orders, orderItems } from '../db/schema.js';
import { isUuid } from '../db/util.js';
import { getLiveFlashDeals, listLiveFlashDealProductIds, toPublicDeal } from '../services/pricing.js';

// --- Search -----------------------------------------------------------------
// Must match the expression of products_search_fts_idx exactly for Postgres to use the index.
const PRODUCT_DOCUMENT = sql`to_tsvector('simple', coalesce(${products.name}, '') || ' ' || coalesce(${products.sku}, '') || ' ' || coalesce(${products.shortSpecs}, '') || ' ' || coalesce(${products.description}, ''))`;

// "hp 840 g9" -> 'hp:* & 840:* & g9:*' (prefix match on every word). Only
// [a-z0-9] survive, so user input can never break tsquery syntax.
function prefixTsQuery(text) {
  const terms = String(text).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).slice(0, 8);
  return terms.length ? terms.map((t) => `${t}:*`).join(' & ') : null;
}

function searchCondition(text) {
  const q = String(text).trim().slice(0, 100);
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const tsq = prefixTsQuery(q);
  return or(
    ...(tsq ? [sql`${PRODUCT_DOCUMENT} @@ to_tsquery('simple', ${tsq})`] : []),
    ilike(products.name, like),
    ilike(products.sku, like),
    ilike(brands.name, like)
  );
}

// Relevance: full-text rank plus trigram similarity of the name (typo tolerance).
function searchRank(text) {
  const q = String(text).trim().slice(0, 100);
  const tsq = prefixTsQuery(q);
  return tsq
    ? sql`ts_rank(${PRODUCT_DOCUMENT}, to_tsquery('simple', ${tsq})) + similarity(${products.name}, ${q})`
    : sql`similarity(${products.name}, ${q})`;
}

// Attaches live flash deals (and the legacy isFlashDeal/flashDealEnds fields
// the storefront already reads) to API products.
async function withFlashDeals(apiProducts) {
  const deals = await getLiveFlashDeals(apiProducts.map((p) => p.id));
  return apiProducts.map((p) => {
    const deal = toPublicDeal(deals.get(p.id), p.price);
    return { ...p, flashDeal: deal, isFlashDeal: !!deal, flashDealEnds: deal?.endsAt || null };
  });
}

// --- Categories ---------------------------------------------------------

export async function listCategories() {
  const rows = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
  const counts = await db
    .select({ categoryId: products.categoryId, count: sql`count(*)::int` })
    .from(products)
    .where(eq(products.isActive, true))
    .groupBy(products.categoryId);
  const countMap = Object.fromEntries(counts.map((c) => [c.categoryId, c.count]));
  return rows.map((c) => ({ ...c, productCount: countMap[c.id] || 0 }));
}

export async function findCategoryBySlugOrId(identifier) {
  // Postgres errors on `uuid_col = $1` when $1 isn't a valid UUID, even in an
  // unmatched OR branch — only compare against id when it looks like one.
  const condition = isUuid(identifier) ? or(eq(categories.slug, identifier), eq(categories.id, identifier)) : eq(categories.slug, identifier);
  const [row] = await db.select().from(categories).where(condition).limit(1);
  return row || null;
}

export async function createCategory(data) {
  const [row] = await db.insert(categories).values(data).returning();
  return row;
}

export async function updateCategory(id, patch) {
  const [row] = await db.update(categories).set({ ...patch, updatedAt: new Date() }).where(eq(categories.id, id)).returning();
  return row || null;
}

export async function findCategoryByName(name) {
  if (!name) return null;
  const [row] = await db.select().from(categories).where(ilike(categories.name, String(name).trim())).limit(1);
  return row || null;
}

// --- Brands --------------------------------------------------------------

export async function listBrands() {
  const rows = await db.select().from(brands).orderBy(asc(brands.name));
  const counts = await db
    .select({ brandId: products.brandId, count: sql`count(*)::int` })
    .from(products)
    .where(eq(products.isActive, true))
    .groupBy(products.brandId);
  const countMap = Object.fromEntries(counts.map((c) => [c.brandId, c.count]));
  return rows.map((b) => ({ ...b, count: countMap[b.id] || 0 }));
}

export async function createBrand(data) {
  const [row] = await db.insert(brands).values(data).returning();
  return row;
}

export async function updateBrand(id, patch) {
  const [row] = await db.update(brands).set(patch).where(eq(brands.id, id)).returning();
  return row || null;
}

export async function findBrandByName(name) {
  if (!name) return null;
  const [row] = await db.select().from(brands).where(ilike(brands.name, String(name).trim())).limit(1);
  return row || null;
}

// --- Products --------------------------------------------------------------

// Reshapes DB rows into the exact frontend Product contract (src/types/index.ts):
// "thumbnail" not "thumbnailUrl", numeric fields as numbers not numeric-strings,
// "brand"/"category" as display names (not ids).
function withRelations(row) {
  if (!row) return null;
  const p = row.products;
  return {
    ...p,
    brand: row.brands?.name || null,
    brandId: p.brandId,
    category: row.categories?.name || null,
    categoryId: p.categoryId,
    categorySlug: row.categories?.slug || null,
    categoryKind: row.categories?.kind || 'product',
    price: Number(p.price),
    compareAtPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
    costPrice: p.costPrice != null ? Number(p.costPrice) : null,
    rating: Number(p.rating),
    thumbnail: p.thumbnailUrl
  };
}

function toApiVariant(v) {
  return {
    id: v.id,
    name: v.name,
    sku: v.sku,
    price: Number(v.price),
    stock: v.stock,
    image: v.imageUrl,
    ...(v.attributes || {})
  };
}

export async function searchProductSuggestions(query) {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      price: products.price,
      compareAtPrice: products.compareAtPrice,
      thumbnailUrl: products.thumbnailUrl,
      stock: products.stock,
      brand: brands.name,
      category: categories.name
    })
    .from(products)
    .leftJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.isActive, true), searchCondition(query)))
    .orderBy(desc(searchRank(query)))
    .limit(8);

  const deals = await getLiveFlashDeals(rows.map((r) => r.id));
  return rows.map((r) => {
    const deal = toPublicDeal(deals.get(r.id), Number(r.price));
    return { ...r, thumbnail: r.thumbnailUrl, price: Number(r.price), compareAtPrice: r.compareAtPrice != null ? Number(r.compareAtPrice) : null, flashDeal: deal };
  });
}

export async function searchCategorySuggestions(query) {
  const like = `%${String(query).trim().slice(0, 60)}%`;
  return db.select({ id: categories.id, name: categories.name, slug: categories.slug }).from(categories)
    .where(ilike(categories.name, like)).limit(4);
}

export async function listProducts({
  category, subcategory, brand, minPrice, maxPrice, condition, inStock,
  featured, flashDeal, search, sortBy, limit = 50, page = 1
} = {}) {
  const conditions = [eq(products.isActive, true)];

  if (category) {
    conditions.push(or(ilike(categories.slug, category), ilike(categories.name, category)));
  }
  if (brand) {
    const brandsList = Array.isArray(brand) ? brand : String(brand).split(',');
    conditions.push(inArray(brands.name, brandsList));
  }
  if (minPrice) conditions.push(gte(products.price, String(minPrice)));
  if (maxPrice) conditions.push(lte(products.price, String(maxPrice)));
  if (condition) conditions.push(ilike(products.condition, `%${condition}%`));
  if (inStock === 'true' || inStock === true) conditions.push(sql`${products.stock} > 0`);
  if (featured === 'true' || featured === true) conditions.push(eq(products.isFeatured, true));
  if (flashDeal === 'true' || flashDeal === true) {
    const ids = await listLiveFlashDealProductIds(100);
    if (!ids.length) return { products: [], total: 0, page: 1, totalPages: 0 };
    conditions.push(inArray(products.id, ids));
  }
  if (search && String(search).trim()) conditions.push(searchCondition(search));

  let orderBy = search && String(search).trim() && !sortBy ? [desc(searchRank(search))] : [desc(products.isFeatured)];
  switch (sortBy) {
    case 'price-asc': orderBy = [asc(products.price)]; break;
    case 'price-desc': orderBy = [desc(products.price)]; break;
    case 'rating': orderBy = [desc(products.rating)]; break;
    case 'newest': orderBy = [desc(products.isNewArrival), desc(products.createdAt)]; break;
    default: break;
  }
  orderBy.push(asc(products.id)); // stable pagination

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 50), 200);
  const offset = (pageNum - 1) * limitNum;

  const baseQuery = db
    .select({ products, brands, categories })
    .from(products)
    .leftJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...conditions));

  const rows = await baseQuery.orderBy(...orderBy).limit(limitNum).offset(offset);
  const [{ count: total }] = await db
    .select({ count: sql`count(*)::int` })
    .from(products)
    .leftJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...conditions));

  return {
    products: await withFlashDeals(rows.map(withRelations)),
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum)
  };
}

export async function findProductByIdentifier(identifier) {
  const condition = isUuid(identifier) ? or(eq(products.slug, identifier), eq(products.id, identifier)) : eq(products.slug, identifier);
  const [row] = await db
    .select({ products, brands, categories })
    .from(products)
    .leftJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(condition)
    .limit(1);
  if (!row) return null;

  const variants = await db.select().from(productVariants).where(eq(productVariants.productId, row.products.id));
  const [withDeal] = await withFlashDeals([withRelations(row)]);
  return { ...withDeal, variants: variants.map(toApiVariant) };
}

export async function findRelatedProducts(product, limit = 6) {
  const rows = await db
    .select({ products, brands, categories })
    .from(products)
    .leftJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(
      and(
        eq(products.isActive, true),
        sql`${products.id} != ${product.id}`,
        or(eq(products.categoryId, product.categoryId), eq(products.brandId, product.brandId))
      )
    )
    .limit(limit);
  return withFlashDeals(rows.map(withRelations));
}

// Columns an admin may write. Anything else in a request body is ignored —
// rating, reviewsCount, reservedStock etc. are maintained by the server.
function productColumns(data) {
  const out = {};
  const set = (key, value) => { if (value !== undefined) out[key] = value; };
  const money = (v) => (v === undefined ? undefined : v === null || v === '' ? null : String(Number(v)));
  set('name', data.name);
  set('slug', data.slug);
  set('sku', data.sku);
  set('brandId', data.brandId);
  set('categoryId', data.categoryId);
  set('shortSpecs', data.shortSpecs);
  set('description', data.description);
  set('price', data.price === undefined ? undefined : String(Number(data.price)));
  set('compareAtPrice', money(data.compareAtPrice));
  set('costPrice', money(data.costPrice));
  set('condition', data.condition);
  set('warranty', data.warranty);
  set('stock', data.stock);
  set('reorderLevel', data.reorderLevel);
  set('thumbnailUrl', data.thumbnail ?? data.thumbnailUrl);
  set('images', data.images);
  set('specs', data.specs);
  set('isFeatured', data.isFeatured);
  set('isNewArrival', data.isNewArrival);
  set('isBestSeller', data.isBestSeller);
  set('isActive', data.isActive);
  return out;
}

export async function createProduct(data) {
  const [row] = await db.insert(products).values(productColumns(data)).returning();
  return row;
}

export async function updateProduct(id, data) {
  const [row] = await db.update(products).set({ ...productColumns(data), updatedAt: new Date() }).where(eq(products.id, id)).returning();
  return row;
}

export async function deleteProduct(id) {
  const [row] = await db.delete(products).where(eq(products.id, id)).returning();
  return row;
}

export async function getProductById(id) {
  if (!isUuid(id)) return null;
  const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return row || null;
}

// ---------------------------------------------------------------------------
// Admin catalog: server-side paginated listing and category/brand insights.
// ---------------------------------------------------------------------------

const ADMIN_SORTS = {
  'name-asc': () => [asc(products.name)],
  'name-desc': () => [desc(products.name)],
  'price-asc': () => [asc(products.price)],
  'price-desc': () => [desc(products.price)],
  'stock-asc': () => [asc(sql`${products.stock} - ${products.reservedStock}`)],
  'stock-desc': () => [desc(sql`${products.stock} - ${products.reservedStock}`)],
  'updated-desc': () => [desc(products.updatedAt)],
  'created-desc': () => [desc(products.createdAt)]
};

// Available = on hand minus units held by unpaid orders.
const AVAILABLE = sql`(${products.stock} - ${products.reservedStock})`;

function adminProductConditions({ search, categoryId, brandId, stock, status, minPrice, maxPrice }) {
  const conditions = [];
  if (status === 'active') conditions.push(eq(products.isActive, true));
  else if (status === 'inactive') conditions.push(eq(products.isActive, false));
  if (categoryId && isUuid(categoryId)) conditions.push(eq(products.categoryId, categoryId));
  if (brandId === 'none') conditions.push(sql`${products.brandId} IS NULL`);
  else if (brandId && isUuid(brandId)) conditions.push(eq(products.brandId, brandId));
  if (stock === 'out') conditions.push(sql`${AVAILABLE} <= 0`);
  else if (stock === 'low') conditions.push(sql`${AVAILABLE} > 0 AND ${products.stock} <= ${products.reorderLevel}`);
  else if (stock === 'in') conditions.push(sql`${AVAILABLE} > 0`);
  const min = Number(minPrice);
  const max = Number(maxPrice);
  if (minPrice !== undefined && minPrice !== '' && Number.isFinite(min)) conditions.push(gte(products.price, String(min)));
  if (maxPrice !== undefined && maxPrice !== '' && Number.isFinite(max)) conditions.push(lte(products.price, String(max)));
  if (search && String(search).trim()) conditions.push(searchCondition(search));
  return conditions;
}

// Staff product table: includes hidden products, stock filters and stable
// paging. `counts` answer "how many are low/out of stock" for the filter chips
// under the current search/category/brand (ignoring the stock/status chip itself).
export async function listProductsAdmin(query = {}) {
  const pageNum = Math.max(1, parseInt(query.page, 10) || 1);
  const limitNum = Math.min(Math.max(5, parseInt(query.limit, 10) || 25), 100);
  const conditions = adminProductConditions(query);
  const where = conditions.length ? and(...conditions) : undefined;
  const sortKey = ADMIN_SORTS[query.sort] ? query.sort : (query.search ? null : 'updated-desc');
  const orderBy = sortKey ? ADMIN_SORTS[sortKey]() : [desc(searchRank(query.search))];
  orderBy.push(asc(products.id));

  const base = () => db.select({ products, brands, categories }).from(products)
    .leftJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(categories, eq(products.categoryId, categories.id));

  const chipConditions = adminProductConditions({ ...query, stock: undefined, status: undefined });
  const chipWhere = chipConditions.length ? and(...chipConditions) : undefined;

  const [rows, [{ total }], [counts]] = await Promise.all([
    base().where(where).orderBy(...orderBy).limit(limitNum).offset((pageNum - 1) * limitNum),
    db.select({ total: sql`count(*)::int` }).from(products)
      .leftJoin(brands, eq(products.brandId, brands.id)).leftJoin(categories, eq(products.categoryId, categories.id)).where(where),
    db.select({
      all: sql`count(*)::int`,
      active: sql`count(*) filter (where ${products.isActive})::int`,
      inactive: sql`count(*) filter (where not ${products.isActive})::int`,
      out: sql`count(*) filter (where ${AVAILABLE} <= 0)::int`,
      low: sql`count(*) filter (where ${AVAILABLE} > 0 and ${products.stock} <= ${products.reorderLevel})::int`
    }).from(products)
      .leftJoin(brands, eq(products.brandId, brands.id)).leftJoin(categories, eq(products.categoryId, categories.id)).where(chipWhere)
  ]);

  return {
    products: rows.map((r) => ({ ...withRelations(r), available: r.products.stock - r.products.reservedStock })),
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.max(1, Math.ceil(total / limitNum)),
    counts
  };
}

// Stock, pricing and recent sales for one category or brand (paid orders only).
export async function getCatalogInsights({ categoryId, brandId }) {
  const scope = categoryId ? eq(products.categoryId, categoryId) : eq(products.brandId, brandId);
  const since30 = new Date(Date.now() - 30 * 86400000);
  const since60 = new Date(Date.now() - 60 * 86400000);

  const [[inventory], [sales]] = await Promise.all([
    db.select({
      totalProducts: sql`count(*)::int`,
      activeProducts: sql`count(*) filter (where ${products.isActive})::int`,
      inStock: sql`count(*) filter (where ${AVAILABLE} > 0)::int`,
      outOfStock: sql`count(*) filter (where ${AVAILABLE} <= 0)::int`,
      lowStock: sql`count(*) filter (where ${AVAILABLE} > 0 and ${products.stock} <= ${products.reorderLevel})::int`,
      inventoryValue: sql`coalesce(sum(${products.price} * ${products.stock}), 0)::float`,
      avgPrice: sql`coalesce(avg(${products.price}), 0)::float`,
      minPrice: sql`coalesce(min(${products.price}), 0)::float`,
      maxPrice: sql`coalesce(max(${products.price}), 0)::float`
    }).from(products).where(scope),
    db.select({
      unitsSold: sql`coalesce(sum(${orderItems.quantity}), 0)::int`,
      revenue30: sql`coalesce(sum(${orderItems.unitPrice} * ${orderItems.quantity}) filter (where ${gte(orders.paidAt, since30)}), 0)::float`,
      revenuePrev30: sql`coalesce(sum(${orderItems.unitPrice} * ${orderItems.quantity}) filter (where ${and(gte(orders.paidAt, since60), lt(orders.paidAt, since30))}), 0)::float`
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(and(scope, eq(orders.paymentStatus, 'Paid')))
  ]);

  return {
    inventory,
    sales: { ...sales, revenueChange: sales.revenuePrev30 > 0 ? (sales.revenue30 - sales.revenuePrev30) / sales.revenuePrev30 : null }
  };
}

export async function countProductsIn({ categoryId, brandId }) {
  const [row] = await db.select({ n: sql`count(*)::int` }).from(products)
    .where(categoryId ? eq(products.categoryId, categoryId) : eq(products.brandId, brandId));
  return row.n;
}

export async function deleteCategory(id) {
  const [row] = await db.delete(categories).where(eq(categories.id, id)).returning({ id: categories.id, name: categories.name });
  return row || null;
}

export async function deleteBrand(id) {
  const [row] = await db.delete(brands).where(eq(brands.id, id)).returning({ id: brands.id, name: brands.name });
  return row || null;
}

export async function findBrandById(id) {
  if (!isUuid(id)) return null;
  const [row] = await db.select().from(brands).where(eq(brands.id, id)).limit(1);
  return row || null;
}
