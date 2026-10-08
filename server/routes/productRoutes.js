import express from 'express';
import { z } from 'zod';
import {
  searchProductSuggestions,
  searchCategorySuggestions,
  listProducts,
  findProductByIdentifier,
  findRelatedProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductById,
  findCategoryByName,
  findBrandByName,
  listProductsAdmin
} from '../repositories/catalogRepo.js';
import { listApprovedReviews, getRatingSummary } from '../repositories/reviewsRepo.js';
import { logAudit } from '../repositories/auditLogsRepo.js';
import { requirePermission } from '../middleware/authorize.js';
import { formatZodError } from '../schemas/authSchemas.js';

const router = express.Router();

const money = z.union([z.number(), z.string().trim()]).transform((v) => (v === '' ? null : Number(v)))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v < 1e10), 'Enter a valid amount');
const optionalText = (max) => z.string().trim().max(max).optional().nullable();

// specs: { "Display": { "Size": "15.6 in", "Resolution": "1920 x 1080" }, ... }
// Section and attribute names are free text so each category can use what fits.
const specsSchema = z.record(
  z.string().trim().min(1).max(60),
  z.record(z.string().trim().min(1).max(60), z.string().trim().max(300))
).refine((s) => Object.keys(s).length <= 20, 'Too many specification sections');

const productSchema = z.object({
  name: z.string().trim().min(2, 'Product name is required').max(200),
  sku: z.string().trim().min(2, 'SKU is required').max(60).regex(/^[A-Za-z0-9._\-/]+$/, 'SKU may contain letters, numbers and . _ - / only'),
  slug: z.string().trim().max(200).optional(),
  categoryId: z.string().uuid().optional(),
  category: z.string().trim().max(120).optional(),
  brandId: z.string().uuid().optional().nullable(),
  brand: z.string().trim().max(120).optional().nullable(),
  shortSpecs: optionalText(300),
  description: optionalText(10000),
  price: money.refine((v) => v !== null, 'Price is required'),
  compareAtPrice: money.optional().nullable(),
  costPrice: money.optional().nullable(),
  condition: optionalText(60),
  warranty: optionalText(120),
  stock: z.coerce.number().int().min(0).max(1_000_000).optional(),
  reorderLevel: z.coerce.number().int().min(0).max(100_000).optional(),
  thumbnail: optionalText(1000),
  images: z.array(z.string().trim().max(1000)).max(12).optional(),
  specs: specsSchema.optional(),
  isFeatured: z.boolean().optional(),
  isNewArrival: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  isActive: z.boolean().optional()
});

// Sales managers adjust prices and stock only.
const SALES_MANAGER_FIELDS = ['price', 'compareAtPrice', 'stock', 'reorderLevel'];

function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 180);
}

async function resolveRelations(data) {
  const out = { ...data };
  if (!out.categoryId && out.category) {
    const category = await findCategoryByName(out.category);
    if (!category) return { error: `Unknown category: ${out.category}` };
    out.categoryId = category.id;
  }
  if (out.brandId === undefined && out.brand) {
    const brand = await findBrandByName(out.brand);
    out.brandId = brand?.id || null;
  }
  delete out.category;
  delete out.brand;
  return { data: out };
}

function isUniqueViolation(err) {
  return err?.code === '23505' || err?.cause?.code === '23505';
}

// 1. Live predictive search & autocomplete
router.get('/search/suggestions', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    return res.json({ suggestions: [], products: [], categories: [], popular: ['Brand New Laptops', 'Ex-UK Laptops', 'CCTV Kit', 'Network Switch', 'Screen Replacement'] });
  }
  const [matchedProducts, matchedCategories] = await Promise.all([searchProductSuggestions(q), searchCategorySuggestions(q)]);
  res.json({ query: q, products: matchedProducts, categories: matchedCategories, totalMatches: matchedProducts.length });
});

// 2. Catalog with filters & sorting
router.get('/', async (req, res) => {
  res.json(await listProducts(req.query));
});

// 2b. Staff product table: hidden products too, stock filters, server-side paging.
// Declared before /:identifier so "admin" is not treated as a slug.
router.get('/admin', requirePermission('products:read'), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, ...(await listProductsAdmin(req.query)) });
});

// 3. Single product by slug or id, with approved reviews and rating summary
router.get('/:identifier', async (req, res) => {
  const product = await findProductByIdentifier(String(req.params.identifier).slice(0, 200));
  if (!product || (!product.isActive && !['ADMIN', 'SALES_MANAGER'].includes(req.user?.role))) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  const [related, reviews, ratingSummary] = await Promise.all([
    findRelatedProducts(product),
    listApprovedReviews(product.id),
    getRatingSummary(product.id)
  ]);
  res.json({ success: true, product, related, reviews, ratingSummary });
});

// 4. Admin: add product
router.post('/', requirePermission('products:create'), async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const resolved = await resolveRelations(parsed.data);
  if (resolved.error) return res.status(400).json({ success: false, message: resolved.error });
  const data = resolved.data;
  if (!data.categoryId) return res.status(400).json({ success: false, message: 'A valid category is required' });

  data.slug = slugify(data.slug || data.name);
  if (!data.images?.length && data.thumbnail) data.images = [data.thumbnail];

  let product;
  try {
    product = await createProduct(data);
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ success: false, message: 'A product with this SKU or URL slug already exists.' });
    throw err;
  }

  await logAudit({
    actorId: req.user.id, actorName: req.user.name, action: 'PRODUCT_CREATE', entity: 'Product',
    entityId: product.id, newValue: `Price: KES ${Number(product.price).toLocaleString('en-KE')}, Stock: ${product.stock}`, ip: req.ip
  });
  res.status(201).json({ success: true, product });
});

// 5. Update product (admins: all fields; sales managers: price & stock)
router.put('/:id', requirePermission('products:update'), async (req, res) => {
  const existing = await getProductById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });

  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  let patch = parsed.data;
  if (req.user.role !== 'ADMIN') {
    patch = Object.fromEntries(Object.entries(patch).filter(([k]) => SALES_MANAGER_FIELDS.includes(k)));
  }
  const resolved = await resolveRelations(patch);
  if (resolved.error) return res.status(400).json({ success: false, message: resolved.error });
  patch = resolved.data;
  if (patch.slug !== undefined) patch.slug = slugify(patch.slug || existing.name);

  let product;
  try {
    product = await updateProduct(req.params.id, patch);
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ success: false, message: 'Another product already uses this SKU or URL slug.' });
    throw err;
  }

  const changes = [];
  if (patch.price !== undefined && Number(patch.price) !== Number(existing.price)) changes.push(`Price: ${existing.price} -> ${patch.price}`);
  if (patch.stock !== undefined && patch.stock !== existing.stock) changes.push(`Stock: ${existing.stock} -> ${patch.stock}`);
  await logAudit({
    actorId: req.user.id, actorName: req.user.name, action: 'PRODUCT_UPDATE', entity: 'Product',
    entityId: product.id, previousValue: `Price: ${existing.price}, Stock: ${existing.stock}`,
    newValue: changes.join(', ') || `Updated: ${Object.keys(patch).join(', ').slice(0, 200)}`, ip: req.ip
  });

  res.json({ success: true, product: { ...product, price: Number(product.price), stock: product.stock } });
});

// 6. Admin: delete product. Products that appear on orders are deactivated
// instead, so invoices and order history stay intact.
router.delete('/:id', requirePermission('products:delete'), async (req, res) => {
  const existing = await getProductById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });
  try {
    await deleteProduct(existing.id);
  } catch (err) {
    if (err?.code === '23503' || err?.cause?.code === '23503') {
      await updateProduct(existing.id, { isActive: false });
      await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'PRODUCT_DEACTIVATE', entity: 'Product', entityId: existing.id, previousValue: `SKU: ${existing.sku}`, newValue: 'Deactivated (has order history)', ip: req.ip });
      return res.json({ success: true, deactivated: true, message: 'This product has order history, so it was hidden from the store instead of deleted.' });
    }
    throw err;
  }
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'PRODUCT_DELETE', entity: 'Product', entityId: existing.id, previousValue: `SKU: ${existing.sku}`, newValue: 'Deleted from catalog', ip: req.ip });
  res.json({ success: true, message: 'Product deleted successfully' });
});

export default router;
