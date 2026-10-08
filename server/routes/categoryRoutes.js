import express from 'express';
import { listCategories, createCategory, updateCategory, findCategoryBySlugOrId, getCatalogInsights, countProductsIn, deleteCategory } from '../repositories/catalogRepo.js';
import { isUuid } from '../db/util.js';
import { logAudit } from '../repositories/auditLogsRepo.js';
import { requirePermission } from '../middleware/authorize.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const categories = await listCategories();
  res.json({ success: true, categories });
});

router.post('/', requirePermission('categories:write'), async (req, res) => {
  const { name, kind, description, imageUrl, icon, sortOrder } = req.body;
  if (!name || String(name).trim().length < 2) return res.status(400).json({ success: false, message: 'Category name is required' });
  const slug = (req.body.slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const category = await createCategory({
    name, slug, kind: kind === 'service' ? 'service' : 'product',
    description, imageUrl, icon, sortOrder: sortOrder || 0
  });

  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'CATEGORY_CREATE', entity: 'Category', entityId: category.id, newValue: category.name, ip: req.ip });
  res.status(201).json({ success: true, category });
});

// Category detail: inventory, pricing and sales figures for the admin drawer.
router.get('/:id/insights', requirePermission('categories:read'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Category not found' });
  const category = await findCategoryBySlugOrId(req.params.id);
  if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
  res.json({ success: true, category, ...(await getCatalogInsights({ categoryId: category.id })) });
});

router.put('/:id', requirePermission('categories:write'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Category not found' });
  const { name, description, imageUrl, icon, sortOrder, kind } = req.body || {};
  if (name !== undefined && String(name).trim().length < 2) return res.status(400).json({ success: false, message: 'Category name is required' });
  const category = await updateCategory(req.params.id, {
    name: name !== undefined ? String(name).trim().slice(0, 120) : undefined,
    description: description !== undefined ? String(description).slice(0, 1000) || null : undefined,
    imageUrl: imageUrl !== undefined ? String(imageUrl).slice(0, 1000) || null : undefined,
    icon: icon !== undefined ? String(icon).slice(0, 60) || null : undefined,
    sortOrder: sortOrder !== undefined ? Number(sortOrder) || 0 : undefined,
    kind: kind === 'service' || kind === 'product' ? kind : undefined
  });
  if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'CATEGORY_UPDATE', entity: 'Category', entityId: category.id, newValue: category.name, ip: req.ip });
  res.json({ success: true, category });
});

// Only an empty category can be deleted (products must keep a category).
router.delete('/:id', requirePermission('categories:write'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Category not found' });
  const count = await countProductsIn({ categoryId: req.params.id });
  if (count > 0) {
    return res.status(409).json({ success: false, message: `This category still has ${count} product${count === 1 ? '' : 's'}. Move or delete them first.` });
  }
  const deleted = await deleteCategory(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, message: 'Category not found' });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'CATEGORY_DELETE', entity: 'Category', entityId: deleted.id, previousValue: deleted.name, ip: req.ip });
  res.json({ success: true });
});

export default router;
