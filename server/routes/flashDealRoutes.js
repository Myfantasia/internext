import express from 'express';
import { z } from 'zod';
import { requirePermission } from '../middleware/authorize.js';
import { logAudit } from '../repositories/auditLogsRepo.js';
import { formatZodError } from '../schemas/authSchemas.js';
import { getProductById } from '../repositories/catalogRepo.js';
import {
  listDealsForAdmin, listLiveDeals, findDeal, createDeal, updateDeal, findOverlappingDeal, dealState
} from '../repositories/flashDealsRepo.js';
import { applyDiscount } from '../services/pricing.js';
import { isUuid } from '../db/util.js';

const router = express.Router();

// Development diagnostics: why a deal was rejected, with the fields that
// matter (never logged in production; the user always gets a safe message).
function logRejected(req, reason) {
  if (process.env.NODE_ENV === 'production') return;
  const { productId, discountType, discountValue, startsAt, endsAt, quantityLimit, isActive } = req.body || {};
  console.warn(`[flash-deals] ${req.method} ${req.originalUrl} rejected: ${reason}`, { productId, discountType, discountValue, startsAt, endsAt, quantityLimit, isActive });
}

const dealSchema = z.object({
  productId: z.string().uuid('Choose a product'),
  title: z.string().trim().min(3, 'Give the deal a title').max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.coerce.number().positive('The discount must be greater than zero'),
  startsAt: z.coerce.date({ message: 'Choose when the deal starts' }),
  endsAt: z.coerce.date({ message: 'Choose when the deal ends' }),
  quantityLimit: z.coerce.number().int('Quantity must be a whole number').positive('Quantity must be at least 1').max(100_000).optional().nullable(),
  isActive: z.boolean().optional()
}).superRefine((d, ctx) => {
  if (d.endsAt <= d.startsAt) ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'The end date must be after the start date' });
  if (d.discountType === 'percentage' && (d.discountValue < 1 || d.discountValue >= 100)) ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'The discount percentage must be between 1 and 99' });
});

async function validateAgainstProduct(data, excludeId) {
  const product = await getProductById(data.productId);
  if (!product) return 'The selected product does not exist. Refresh the page and choose another.';
  if (product.isActive === false) return 'This product is hidden from the store. Activate it before creating a deal.';
  // Deal stock comes out of normal stock, so a cap above what is on hand would oversell.
  const onHand = Number(product.stock ?? 0) - Number(product.reservedStock ?? 0);
  if (data.quantityLimit != null && data.quantityLimit > onHand) {
    return `Quantity at this price (${data.quantityLimit}) is more than the ${Math.max(0, onHand)} available in stock.`;
  }
  if (data.discountType === 'fixed' && data.discountValue >= Number(product.price)) {
    return `The discount must be less than the product price (KES ${Number(product.price).toLocaleString('en-KE')})`;
  }
  if (data.isActive !== false) {
    const overlap = await findOverlappingDeal({ productId: data.productId, startsAt: data.startsAt, endsAt: data.endsAt, excludeId });
    if (overlap) return `An active flash deal ("${overlap.title}") already covers this product during those dates. Change the dates or deactivate that deal first.`;
  }
  return null;
}

// Public: live deals + the server's clock, so countdowns don't depend on the
// visitor's device time.
router.get('/', async (req, res) => {
  const deals = await listLiveDeals(Math.min(Number(req.query.limit) || 12, 24));
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, serverTime: new Date().toISOString(), deals });
});

router.get('/admin', requirePermission('flash_deals:read'), async (req, res) => {
  res.json({ success: true, serverTime: new Date().toISOString(), deals: await listDealsForAdmin({ includeArchived: req.query.archived === 'true' }) });
});

router.post('/', requirePermission('flash_deals:write'), async (req, res) => {
  const parsed = dealSchema.safeParse(req.body);
  if (!parsed.success) {
    logRejected(req, formatZodError(parsed.error));
    return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  }
  const problem = await validateAgainstProduct(parsed.data);
  if (problem) {
    logRejected(req, problem);
    return res.status(400).json({ success: false, message: problem });
  }

  const deal = await createDeal({
    ...parsed.data, discountValue: String(parsed.data.discountValue), description: parsed.data.description || null,
    quantityLimit: parsed.data.quantityLimit ?? null, isActive: parsed.data.isActive ?? true
  }, req.user.id);
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'FLASH_DEAL_CREATE', entity: 'Flash Deal', entityId: deal.id, newValue: deal.title, ip: req.ip });
  res.status(201).json({ success: true, deal: { ...deal, state: dealState(deal) } });
});

router.put('/:id', requirePermission('flash_deals:write'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Deal not found' });
  const existing = await findDeal(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Deal not found' });
  const parsed = dealSchema.safeParse(req.body);
  if (!parsed.success) {
    logRejected(req, formatZodError(parsed.error));
    return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  }
  if (parsed.data.quantityLimit != null && parsed.data.quantityLimit < existing.quantitySold) {
    return res.status(400).json({ success: false, message: `${existing.quantitySold} units have already sold at this price; the limit cannot be lower.` });
  }
  const problem = await validateAgainstProduct(parsed.data, existing.id);
  if (problem) {
    logRejected(req, problem);
    return res.status(400).json({ success: false, message: problem });
  }

  const deal = await updateDeal(existing.id, {
    ...parsed.data, discountValue: String(parsed.data.discountValue), description: parsed.data.description || null,
    quantityLimit: parsed.data.quantityLimit ?? null, isActive: parsed.data.isActive ?? existing.isActive
  });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'FLASH_DEAL_UPDATE', entity: 'Flash Deal', entityId: deal.id, newValue: deal.title, ip: req.ip });
  res.json({ success: true, deal: { ...deal, state: dealState(deal) } });
});

router.patch('/:id/status', requirePermission('flash_deals:write'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Deal not found' });
  const existing = await findDeal(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Deal not found' });
  const isActive = req.body?.isActive === true;
  if (isActive) {
    const overlap = await findOverlappingDeal({ productId: existing.productId, startsAt: existing.startsAt, endsAt: existing.endsAt, excludeId: existing.id });
    if (overlap) return res.status(400).json({ success: false, message: `Another active deal ("${overlap.title}") overlaps this one` });
  }
  const deal = await updateDeal(existing.id, { isActive });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: isActive ? 'FLASH_DEAL_ACTIVATE' : 'FLASH_DEAL_DEACTIVATE', entity: 'Flash Deal', entityId: deal.id, ip: req.ip });
  res.json({ success: true, deal: { ...deal, state: dealState(deal) } });
});

// Archive (soft delete): keeps the record for orders that used the deal price.
router.delete('/:id', requirePermission('flash_deals:write'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Deal not found' });
  const deal = await updateDeal(req.params.id, { archivedAt: new Date(), isActive: false });
  if (!deal) return res.status(404).json({ success: false, message: 'Deal not found' });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'FLASH_DEAL_ARCHIVE', entity: 'Flash Deal', entityId: deal.id, ip: req.ip });
  res.json({ success: true });
});

// Preview the resulting price while the admin fills the form.
router.get('/preview-price', requirePermission('flash_deals:read'), async (req, res) => {
  const product = await getProductById(String(req.query.productId || ''));
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  const type = req.query.discountType === 'fixed' ? 'fixed' : 'percentage';
  res.json({ success: true, price: Number(product.price), dealPrice: applyDiscount(product.price, type, Number(req.query.discountValue) || 0) });
});

export default router;
