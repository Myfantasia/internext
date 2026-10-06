import { eq, ne, and, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { blogPosts } from '../db/schema.js';
import { isUuid } from '../db/util.js';

export async function listBlogPosts() {
  return db.select().from(blogPosts).orderBy(desc(blogPosts.publishedAt));
}

export async function findBlogPostBySlugOrId(identifier) {
  const [row] = await db.select().from(blogPosts).where(eq(blogPosts.slug, identifier)).limit(1);
  if (row || !isUuid(identifier)) return row || null;
  const [byId] = await db.select().from(blogPosts).where(eq(blogPosts.id, identifier)).limit(1);
  return byId || null;
}

export async function findRelatedBlogPosts(post, limit = 3) {
  return db
    .select()
    .from(blogPosts)
    .where(and(ne(blogPosts.id, post.id), eq(blogPosts.category, post.category)))
    .limit(limit);
}

export async function createBlogPost(data) {
  const [row] = await db.insert(blogPosts).values(data).returning();
  return row;
}
