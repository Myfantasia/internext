import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { staffSignupCodes, users } from '../db/schema.js';

const CODE_TTL_MS = 1000 * 60 * 60 * 24;

export async function createStaffSignupCode({ email, role, codeHash, createdBy }) {
  const [row] = await db.insert(staffSignupCodes).values({
    email: email.toLowerCase(), role, codeHash, createdBy, expiresAt: new Date(Date.now() + CODE_TTL_MS)
  }).returning();
  return row;
}

export async function listStaffSignupCodes() {
  return db.select({
    id: staffSignupCodes.id,
    email: staffSignupCodes.email,
    role: staffSignupCodes.role,
    createdBy: staffSignupCodes.createdBy,
    expiresAt: staffSignupCodes.expiresAt,
    consumedAt: staffSignupCodes.consumedAt,
    revokedAt: staffSignupCodes.revokedAt,
    createdAt: staffSignupCodes.createdAt
  }).from(staffSignupCodes).orderBy(sql`${staffSignupCodes.createdAt} desc`);
}

export async function revokeStaffSignupCode(id) {
  const [row] = await db.update(staffSignupCodes).set({ revokedAt: new Date() })
    .where(and(eq(staffSignupCodes.id, id), isNull(staffSignupCodes.consumedAt), isNull(staffSignupCodes.revokedAt)))
    .returning({ id: staffSignupCodes.id });
  return row || null;
}

export async function registerWithStaffCode({ codeHash, name, email, phone, passwordHash, referredBy }) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(73190544)`);
    const [code] = await tx.select().from(staffSignupCodes)
      .where(and(eq(staffSignupCodes.codeHash, codeHash), isNull(staffSignupCodes.consumedAt), isNull(staffSignupCodes.revokedAt)))
      .for('update').limit(1);
    if (!code || code.expiresAt < new Date() || code.email !== email.toLowerCase()) return { error: 'invalid_code' };

    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (existing) return { error: 'existing_user' };

    const [user] = await tx.insert(users).values({
      name, email: email.toLowerCase(), phone, passwordHash, role: code.role, referredBy
    }).returning();
    await tx.update(staffSignupCodes).set({ consumedAt: new Date(), consumedBy: user.id })
      .where(eq(staffSignupCodes.id, code.id));
    return { user };
  });
}
