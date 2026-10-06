import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requirePermission } from '../middleware/authorize.js';
import { logAudit } from '../repositories/auditLogsRepo.js';
import { formatZodError } from '../schemas/authSchemas.js';
import { updateCompanyProfile } from '../repositories/companyProfileRepo.js';
import {
  getDeliveryConfig, quoteDelivery, saveBand, deleteBand, saveOption, deleteOption, findBandOverlap, DeliveryError
} from '../services/delivery.js';
import { KENYA_COUNTIES, isWithinKenya } from '../services/location.js';
import { isUuid } from '../db/util.js';

const router = express.Router();

const quoteLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

const optionalMoney = z.union([z.coerce.number().min(0).max(1e9), z.null()]).optional();

const bandSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().nullable(),
  minKm: z.coerce.number().min(0).max(5000),
  maxKm: z.union([z.coerce.number().positive().max(5000), z.null()]).optional(),
  fee: z.coerce.number().min(0).max(1e7),
  freeThreshold: optionalMoney,
  estimatedTime: z.string().trim().max(80).optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(1000).optional()
}).refine((b) => b.maxKm == null || b.maxKm > b.minKm, { message: 'The upper distance must be greater than the lower distance', path: ['maxKm'] });

const optionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  kind: z.enum(['pickup', 'fixed']),
  description: z.string().trim().max(500).optional().nullable(),
  fee: z.coerce.number().min(0).max(1e7),
  freeThreshold: optionalMoney,
  estimatedTime: z.string().trim().max(80).optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(1000).optional()
});

const settingsSchema = z.object({
  officeLat: z.coerce.number(),
  officeLng: z.coerce.number(),
  roadDistanceFactor: z.coerce.number().min(1).max(3),
  outOfRangeFee: optionalMoney
}).refine((s) => isWithinKenya(s.officeLat, s.officeLng), { message: 'The office location must be inside Kenya', path: ['officeLat'] });

const quoteSchema = z.object({
  mode: z.enum(['distance', 'option']),
  optionId: z.string().uuid().optional(),
  coordinates: z.object({ lat: z.any(), lng: z.any() }).optional().nullable(),
  county: z.string().trim().max(60).optional(),
  subtotal: z.coerce.number().min(0).max(1e10).optional()
});

// Public: what the checkout needs to render delivery choices. The office
// position is the shop's public address, rounded to ~100 m.
router.get('/config', async (_req, res) => {
  const cfg = await getDeliveryConfig();
  res.json({
    success: true,
    office: cfg.office ? { lat: Math.round(cfg.office.lat * 1000) / 1000, lng: Math.round(cfg.office.lng * 1000) / 1000, address: cfg.office.address } : null,
    bands: cfg.bands,
    options: cfg.options,
    outsideRange: cfg.outOfRangeFee == null ? 'pickup-or-call' : 'flat-fee'
  });
});

router.get('/counties', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.json({ success: true, counties: KENYA_COUNTIES.map((c) => ({ name: c.name, code: c.code })) });
});

// Public quote (used while the shopper picks a location). The order itself is
// re-quoted on the server, so this is informational only.
router.post('/quote', quoteLimiter, async (req, res) => {
  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  try {
    const quote = await quoteDelivery(parsed.data, parsed.data.subtotal ?? 0);
    res.json({ success: true, quote });
  } catch (err) {
    if (err instanceof DeliveryError) return res.status(400).json({ success: false, code: err.code, message: err.message });
    throw err;
  }
});

// --- Admin -----------------------------------------------------------------

router.get('/admin', requirePermission('delivery:read'), async (_req, res) => {
  const cfg = await getDeliveryConfig({ includeInactive: true });
  res.json({ success: true, ...cfg });
});

router.put('/admin/settings', requirePermission('delivery:write'), async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const s = parsed.data;
  await updateCompanyProfile({
    officeLat: String(s.officeLat), officeLng: String(s.officeLng),
    roadDistanceFactor: String(s.roadDistanceFactor), outOfRangeFee: s.outOfRangeFee == null ? null : String(s.outOfRangeFee)
  });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'DELIVERY_SETTINGS_UPDATE', entity: 'Delivery', newValue: `Office ${s.officeLat},${s.officeLng}; factor ${s.roadDistanceFactor}`, ip: req.ip });
  res.json({ success: true, ...(await getDeliveryConfig({ includeInactive: true })) });
});

async function saveBandWithChecks(req, res, id) {
  const parsed = bandSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const cfg = await getDeliveryConfig({ includeInactive: true });
  const candidate = { ...parsed.data, id: id || 'new', maxKm: parsed.data.maxKm ?? null };
  const overlap = findBandOverlap([...cfg.bands.filter((b) => b.id !== id), candidate]);
  if (overlap) {
    const fmt = (b) => `"${b.name}" (${b.minKm}–${b.maxKm ?? '∞'} km)`;
    return res.status(400).json({ success: false, message: `Distance ranges overlap: ${fmt(overlap[0])} and ${fmt(overlap[1])}. Adjust the ranges so each distance has exactly one price.` });
  }
  const band = await saveBand(id, candidate);
  if (!band) return res.status(404).json({ success: false, message: 'Band not found' });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: id ? 'DELIVERY_BAND_UPDATE' : 'DELIVERY_BAND_CREATE', entity: 'Delivery', entityId: band.id, newValue: `${band.name}: ${band.minKm}-${band.maxKm ?? '∞'} km = KES ${band.fee}`, ip: req.ip });
  return res.status(id ? 200 : 201).json({ success: true, band });
}

router.post('/admin/bands', requirePermission('delivery:write'), (req, res) => saveBandWithChecks(req, res, null));
router.put('/admin/bands/:id', requirePermission('delivery:write'), (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Band not found' });
  return saveBandWithChecks(req, res, req.params.id);
});
router.delete('/admin/bands/:id', requirePermission('delivery:write'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Band not found' });
  const band = await deleteBand(req.params.id);
  if (!band) return res.status(404).json({ success: false, message: 'Band not found' });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'DELIVERY_BAND_DELETE', entity: 'Delivery', entityId: band.id, previousValue: band.name, ip: req.ip });
  res.json({ success: true });
});

router.post('/admin/options', requirePermission('delivery:write'), async (req, res) => {
  const parsed = optionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const option = await saveOption(null, parsed.data);
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'DELIVERY_OPTION_CREATE', entity: 'Delivery', entityId: option.id, newValue: option.name, ip: req.ip });
  res.status(201).json({ success: true, option });
});
router.put('/admin/options/:id', requirePermission('delivery:write'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Option not found' });
  const parsed = optionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const option = await saveOption(req.params.id, parsed.data);
  if (!option) return res.status(404).json({ success: false, message: 'Option not found' });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'DELIVERY_OPTION_UPDATE', entity: 'Delivery', entityId: option.id, newValue: option.name, ip: req.ip });
  res.json({ success: true, option });
});
router.delete('/admin/options/:id', requirePermission('delivery:write'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Option not found' });
  const option = await deleteOption(req.params.id);
  if (!option) return res.status(404).json({ success: false, message: 'Option not found' });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'DELIVERY_OPTION_DELETE', entity: 'Delivery', entityId: option.id, previousValue: option.name, ip: req.ip });
  res.json({ success: true });
});

export default router;
