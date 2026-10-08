import { and, asc, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { expenses, users } from '../db/schema.js';

// Expense records entered by admins; the finance dashboard totals them by
// spent_on date. Dates are plain YYYY-MM-DD (Nairobi calendar days).

const toApi = (r) => ({ ...r, amount: Number(r.amount) });

export async function listExpenses({ from, to, category, search, page = 1, limit = 25, sort = 'date-desc' } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(Math.max(5, parseInt(limit, 10) || 25), 100);
  const conditions = [];
  if (/^\d{4}-\d{2}-\d{2}$/.test(from || '')) conditions.push(gte(expenses.spentOn, from));
  if (/^\d{4}-\d{2}-\d{2}$/.test(to || '')) conditions.push(lte(expenses.spentOn, to));
  if (category) conditions.push(eq(expenses.category, String(category).slice(0, 60)));
  const q = String(search || '').trim().slice(0, 100);
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conditions.push(or(ilike(expenses.description, like), ilike(expenses.reference, like)));
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const orderBy = {
    'date-desc': [desc(expenses.spentOn), desc(expenses.createdAt)],
    'date-asc': [asc(expenses.spentOn), asc(expenses.createdAt)],
    'amount-desc': [desc(expenses.amount)],
    'amount-asc': [asc(expenses.amount)]
  }[sort] || [desc(expenses.spentOn)];

  const [rows, [{ total, sum }]] = await Promise.all([
    db.select({ expense: expenses, createdByName: users.name }).from(expenses).leftJoin(users, eq(users.id, expenses.createdBy))
      .where(where).orderBy(...orderBy, asc(expenses.id)).limit(limitNum).offset((pageNum - 1) * limitNum),
    db.select({ total: sql`count(*)::int`, sum: sql`coalesce(sum(${expenses.amount}), 0)::float` }).from(expenses).where(where)
  ]);
  return {
    expenses: rows.map((r) => ({ ...toApi(r.expense), createdByName: r.createdByName })),
    total, sum, page: pageNum, limit: limitNum, totalPages: Math.max(1, Math.ceil(total / limitNum))
  };
}

export async function findExpense(id) {
  const [row] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  return row ? toApi(row) : null;
}

export async function createExpense(data, userId) {
  const [row] = await db.insert(expenses).values({ ...data, amount: String(data.amount), createdBy: userId }).returning();
  return toApi(row);
}

export async function updateExpense(id, data) {
  const patch = { ...data, updatedAt: new Date() };
  if (patch.amount != null) patch.amount = String(patch.amount);
  const [row] = await db.update(expenses).set(patch).where(eq(expenses.id, id)).returning();
  return row ? toApi(row) : null;
}

export async function deleteExpense(id) {
  const [row] = await db.delete(expenses).where(eq(expenses.id, id)).returning();
  return row ? toApi(row) : null;
}
