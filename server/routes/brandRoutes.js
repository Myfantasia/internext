import express from 'express';
import { listBrands, createBrand, updateBrand } from '../repositories/catalogRepo.js';
import { isUuid } from '../db/util.js';
import { logAudit } from '../repositories/auditLogsRepo.js';
import { requirePermission } from '../middleware/authorize.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const brands = await listBrands();
  res.json({ success: true, brands });
});

router.post('/', requirePermission('brands:write'), async (req, res) => {
  const { name, logoUrl, description } = req.body;
  if (!name || String(name).trim().length < 2) return res.status(400).json({ success: false, message: 'Brand name is required' });
  const slug = (req.body.slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const brand = await createBrand({ name, slug, logoUrl, description: description ? String(description).slice(0, 1000) : null });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'BRAND_CREATE', entity: 'Brand', entityId: brand.id, newValue: brand.name, ip: req.ip });
  res.status(201).json({ success: true, brand });
});

router.put('/:id', requirePermission('brands:write'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Brand not found' });
  const { name, logoUrl, description } = req.body || {};
  const brand = await updateBrand(req.params.id, {
    name: name !== undefined ? String(name).trim().slice(0, 120) : undefined,
    logoUrl: logoUrl !== undefined ? String(logoUrl).slice(0, 1000) || null : undefined,
    description: description !== undefined ? String(description).slice(0, 1000) || null : undefined
  });
  if (!brand) return res.status(404).json({ success: false, message: 'Brand not found' });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'BRAND_UPDATE', entity: 'Brand', entityId: brand.id, newValue: brand.name, ip: req.ip });
  res.json({ success: true, brand });
});

export default router;
