import express from 'express';
import { z } from 'zod';
import { requirePermission } from '../middleware/authorize.js';
import { logAudit } from '../repositories/auditLogsRepo.js';
import { formatZodError } from '../schemas/authSchemas.js';
import { isValidCounty } from '../services/location.js';
import { assertPublicHttpUrl } from '../services/newsFeeds.js';
import {
  listPublishedArticles, findPublishedArticle, newsFacets, listArticlesForAdmin, findArticle, createGuide,
  updateArticle, deleteArticle, listSources, saveSource, deleteSource, importSource, importAllSources
} from '../repositories/newsRepo.js';
import { isUuid } from '../db/util.js';

const router = express.Router();

const county = z.string().trim().max(60).optional().nullable()
  .refine((v) => !v || isValidCounty(v), 'Choose a Kenyan county or leave it empty for national news');
const httpUrl = z.string().trim().max(1000).refine((v) => /^https?:\/\//i.test(v), 'Must start with http:// or https://');

const articleSchema = z.object({
  title: z.string().trim().min(5, 'Title is required').max(300),
  summary: z.string().trim().max(600).optional().nullable(),
  content: z.string().trim().max(50_000).optional().nullable(),
  author: z.string().trim().max(120).optional().nullable(),
  imageUrl: z.union([httpUrl, z.string().regex(/^\/uploads\//)]).optional().nullable().or(z.literal('')),
  category: z.string().trim().max(60).optional().nullable(),
  county,
  tags: z.array(z.string().trim().max(40)).max(10).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  publishAt: z.union([z.coerce.date(), z.null()]).optional(),
  isFeatured: z.boolean().optional()
});

const sourceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  feedUrl: httpUrl,
  siteUrl: httpUrl.optional().nullable().or(z.literal('')),
  description: z.string().trim().max(500).optional().nullable(),
  defaultCategory: z.string().trim().max(60).optional().nullable(),
  defaultCounty: county,
  isActive: z.boolean().default(true)
});

const clean = (d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v === '' ? null : v]));

// --- Public storefront ---------------------------------------------------------
router.get('/', async (req, res) => {
  const { county: c, category, q, kind, featured, page, limit } = req.query;
  res.json({ success: true, ...(await listPublishedArticles({ county: c, category, q, kind, featured: featured === 'true', page, limit })) });
});

router.get('/facets', async (_req, res) => {
  res.json({ success: true, ...(await newsFacets()) });
});

// --- Admin (defined before /:slug so "admin" is not read as a slug) -----------
router.get('/admin/articles', requirePermission('news:read'), async (req, res) => {
  res.json({ success: true, articles: await listArticlesForAdmin({ status: req.query.status, kind: req.query.kind, q: req.query.q }) });
});

router.post('/admin/articles', requirePermission('news:write'), async (req, res) => {
  const parsed = articleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  if (!parsed.data.content || parsed.data.content.length < 50) return res.status(400).json({ success: false, message: 'A guide needs at least 50 characters of content.' });
  const article = await createGuide({ ...clean(parsed.data), status: parsed.data.status || 'draft' }, req.user.id);
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'NEWS_GUIDE_CREATE', entity: 'News', entityId: article.id, newValue: article.title, ip: req.ip });
  res.status(201).json({ success: true, article });
});

router.put('/admin/articles/:id', requirePermission('news:write'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Article not found' });
  const parsed = articleSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const article = await updateArticle(req.params.id, clean(parsed.data));
  if (!article) return res.status(404).json({ success: false, message: 'Article not found' });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'NEWS_ARTICLE_UPDATE', entity: 'News', entityId: article.id, newValue: `${article.status}: ${article.title}`.slice(0, 200), ip: req.ip });
  res.json({ success: true, article });
});

router.delete('/admin/articles/:id', requirePermission('news:write'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Article not found' });
  const existing = await findArticle(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Article not found' });
  await deleteArticle(existing.id);
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'NEWS_ARTICLE_DELETE', entity: 'News', entityId: existing.id, previousValue: existing.title, ip: req.ip });
  res.json({ success: true });
});

router.get('/admin/sources', requirePermission('news:read'), async (_req, res) => {
  res.json({ success: true, sources: await listSources() });
});

async function saveSourceHandler(req, res, id) {
  const parsed = sourceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  try {
    await assertPublicHttpUrl(parsed.data.feedUrl);
  } catch (err) {
    return res.status(400).json({ success: false, message: `Feed URL rejected: ${err.message}` });
  }
  try {
    const source = await saveSource(id, clean(parsed.data));
    if (!source) return res.status(404).json({ success: false, message: 'Source not found' });
    await logAudit({ actorId: req.user.id, actorName: req.user.name, action: id ? 'NEWS_SOURCE_UPDATE' : 'NEWS_SOURCE_CREATE', entity: 'News', entityId: source.id, newValue: source.feedUrl, ip: req.ip });
    return res.status(id ? 200 : 201).json({ success: true, source });
  } catch (err) {
    if (err?.code === '23505' || err?.cause?.code === '23505') return res.status(409).json({ success: false, message: 'This feed URL is already registered.' });
    throw err;
  }
}

router.post('/admin/sources', requirePermission('news:write'), (req, res) => saveSourceHandler(req, res, null));
router.put('/admin/sources/:id', requirePermission('news:write'), (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Source not found' });
  return saveSourceHandler(req, res, req.params.id);
});
router.delete('/admin/sources/:id', requirePermission('news:write'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Source not found' });
  const row = await deleteSource(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: 'Source not found' });
  res.json({ success: true });
});

router.post('/admin/sources/:id/fetch', requirePermission('news:write'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Source not found' });
  const result = await importSource(req.params.id);
  if (!result) return res.status(404).json({ success: false, message: 'Source not found' });
  res.json({ success: !result.error, result, message: result.error ? `Could not read the feed: ${result.error}` : `${result.added} new article(s) added for review.` });
});

router.post('/admin/fetch-all', requirePermission('news:write'), async (_req, res) => {
  res.json({ success: true, results: await importAllSources() });
});

// Public article page — last, so it doesn't shadow the routes above.
router.get('/:slug', async (req, res) => {
  const article = await findPublishedArticle(String(req.params.slug).slice(0, 200));
  if (!article) return res.status(404).json({ success: false, message: 'Article not found' });
  res.json({ success: true, article });
});

export default router;
