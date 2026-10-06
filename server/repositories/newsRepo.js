import { and, count, desc, eq, ilike, isNull, lte, or, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '../db/client.js';
import { newsArticles, newsSources } from '../db/schema.js';
import { fetchFeed } from '../services/newsFeeds.js';

export const NEWS_CATEGORIES = ['Kenya Tech', 'Business & Startups', 'Mobile & Telecoms', 'Fintech & M-Pesa', 'Government & Policy', 'Cybersecurity', 'Devices & Reviews', 'Global Tech', 'How-to Guides', 'Buying Guides'];

function slugify(title) {
  const base = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'article';
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

function toApiArticle(a, { full = false } = {}) {
  const now = new Date();
  return {
    id: a.id,
    kind: a.kind,
    title: a.title,
    slug: a.slug,
    summary: a.summary,
    // Only original guides carry a body; aggregated items link to the publisher.
    ...(full && a.kind === 'guide' ? { content: a.content } : {}),
    author: a.author,
    imageUrl: a.imageUrl,
    category: a.category,
    county: a.county,
    tags: a.tags || [],
    sourceName: a.sourceName,
    sourceUrl: a.sourceUrl,
    status: a.status,
    scheduled: a.status === 'published' && a.publishAt && a.publishAt > now,
    publishAt: a.publishAt,
    isFeatured: a.isFeatured,
    originalPublishedAt: a.originalPublishedAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt
  };
}

const isLive = () => and(eq(newsArticles.status, 'published'), or(isNull(newsArticles.publishAt), lte(newsArticles.publishAt, new Date())));

export async function listPublishedArticles({ county, category, q, kind, featured, page = 1, limit = 12 } = {}) {
  const conditions = [isLive()];
  // County pages also show national stories (county IS NULL).
  if (county) conditions.push(or(eq(newsArticles.county, county), isNull(newsArticles.county)));
  if (category) conditions.push(eq(newsArticles.category, category));
  if (kind === 'guide' || kind === 'aggregated') conditions.push(eq(newsArticles.kind, kind));
  if (featured) conditions.push(eq(newsArticles.isFeatured, true));
  if (q) {
    const like = `%${String(q).trim().slice(0, 80)}%`;
    conditions.push(or(ilike(newsArticles.title, like), ilike(newsArticles.summary, like)));
  }
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(Math.max(1, Number(limit) || 12), 50);
  const where = and(...conditions);
  const sortDate = sql`coalesce(${newsArticles.publishAt}, ${newsArticles.originalPublishedAt}, ${newsArticles.createdAt})`;
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(newsArticles).where(where).orderBy(desc(newsArticles.isFeatured), desc(sortDate)).limit(limitNum).offset((pageNum - 1) * limitNum),
    db.select({ total: count() }).from(newsArticles).where(where)
  ]);
  return { articles: rows.map((r) => toApiArticle(r)), total: Number(total), page: pageNum, totalPages: Math.ceil(Number(total) / limitNum) };
}

export async function findPublishedArticle(slug) {
  const [row] = await db.select().from(newsArticles).where(and(eq(newsArticles.slug, slug), isLive())).limit(1);
  return row ? toApiArticle(row, { full: true }) : null;
}

export async function newsFacets() {
  const [counties, categories] = await Promise.all([
    db.select({ county: newsArticles.county, total: count() }).from(newsArticles).where(and(isLive(), sql`${newsArticles.county} IS NOT NULL`)).groupBy(newsArticles.county),
    db.select({ category: newsArticles.category, total: count() }).from(newsArticles).where(and(isLive(), sql`${newsArticles.category} IS NOT NULL`)).groupBy(newsArticles.category)
  ]);
  return {
    counties: counties.map((c) => ({ name: c.county, count: Number(c.total) })).sort((a, b) => b.count - a.count),
    categories: categories.map((c) => ({ name: c.category, count: Number(c.total) })).sort((a, b) => b.count - a.count),
    suggestedCategories: NEWS_CATEGORIES
  };
}

// --- Admin ---------------------------------------------------------------------

export async function listArticlesForAdmin({ status, kind, q } = {}) {
  const conditions = [];
  if (status) conditions.push(eq(newsArticles.status, status));
  if (kind) conditions.push(eq(newsArticles.kind, kind));
  if (q) conditions.push(ilike(newsArticles.title, `%${String(q).slice(0, 80)}%`));
  const rows = await db.select().from(newsArticles).where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(newsArticles.createdAt)).limit(300);
  return rows.map((r) => toApiArticle(r, { full: true }));
}

export async function findArticle(id) {
  const [row] = await db.select().from(newsArticles).where(eq(newsArticles.id, id)).limit(1);
  return row || null;
}

export async function createGuide(data, userId) {
  const [row] = await db.insert(newsArticles).values({
    kind: 'guide', slug: slugify(data.title), createdBy: userId, sourceName: null, sourceUrl: null, ...data
  }).returning();
  return toApiArticle(row, { full: true });
}

export async function updateArticle(id, patch) {
  const existing = await findArticle(id);
  if (!existing) return null;
  // Aggregated items: editors may adjust headline/summary/tags, never add a full body.
  if (existing.kind === 'aggregated') delete patch.content;
  const [row] = await db.update(newsArticles).set({ ...patch, updatedAt: new Date() }).where(eq(newsArticles.id, id)).returning();
  return toApiArticle(row, { full: true });
}

export async function deleteArticle(id) {
  const [row] = await db.delete(newsArticles).where(eq(newsArticles.id, id)).returning({ id: newsArticles.id });
  return row || null;
}

export async function listSources() {
  const rows = await db.select().from(newsSources).orderBy(newsSources.name);
  const counts = await db.select({ sourceId: newsArticles.sourceId, total: count() }).from(newsArticles).groupBy(newsArticles.sourceId);
  const map = Object.fromEntries(counts.map((c) => [c.sourceId, Number(c.total)]));
  return rows.map((s) => ({ ...s, articleCount: map[s.id] || 0 }));
}

export async function saveSource(id, data) {
  if (id) {
    const [row] = await db.update(newsSources).set(data).where(eq(newsSources.id, id)).returning();
    return row || null;
  }
  const [row] = await db.insert(newsSources).values(data).returning();
  return row;
}

export async function deleteSource(id) {
  const [row] = await db.delete(newsSources).where(eq(newsSources.id, id)).returning({ id: newsSources.id });
  return row || null;
}

// Pulls a feed and stores new items as drafts for editorial review.
export async function importSource(sourceId) {
  const [source] = await db.select().from(newsSources).where(eq(newsSources.id, sourceId)).limit(1);
  if (!source) return null;
  try {
    const items = await fetchFeed(source);
    let added = 0;
    for (const item of items) {
      const [row] = await db.insert(newsArticles).values({
        ...item, kind: 'aggregated', sourceId: source.id, sourceName: source.name, slug: slugify(item.title), status: 'draft'
      }).onConflictDoNothing().returning({ id: newsArticles.id });
      if (row) added += 1;
    }
    await db.update(newsSources).set({ lastFetchedAt: new Date(), lastError: null }).where(eq(newsSources.id, source.id));
    return { source: source.name, fetched: items.length, added };
  } catch (err) {
    await db.update(newsSources).set({ lastFetchedAt: new Date(), lastError: String(err.message).slice(0, 300) }).where(eq(newsSources.id, source.id));
    return { source: source.name, error: err.message };
  }
}

export async function importAllSources() {
  const sources = await db.select({ id: newsSources.id }).from(newsSources).where(eq(newsSources.isActive, true));
  const results = [];
  for (const s of sources) results.push(await importSource(s.id));
  return results;
}
