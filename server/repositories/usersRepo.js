import { eq, sql, count } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';

export const SAFE_USER_COLUMNS = {
  id: users.id,
  name: users.name,
  email: users.email,
  phone: users.phone,
  role: users.role,
  avatarUrl: users.avatarUrl,
  addresses: users.addresses,
  isActive: users.isActive,
  emailVerifiedAt: users.emailVerifiedAt,
  referralCode: users.referralCode,
  createdAt: users.createdAt
};

export function toSafeUser(row) {
  if (!row) return null;
  const { passwordHash, failedLoginAttempts, lockedUntil, updatedAt, avatarUrl, ...safe } = row;
  return { ...safe, avatar: avatarUrl };
}

export async function findUserByEmail(email) {
  const [row] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return row || null;
}

export async function findUserById(id) {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row || null;
}

export async function findUserByReferralCode(referralCode) {
  const [row] = await db.select().from(users).where(eq(users.referralCode, referralCode.trim().toUpperCase())).limit(1);
  return row || null;
}

export async function createUser({ name, email, phone, passwordHash, role = 'CUSTOMER', referredBy = null }) {
  const [row] = await db
    .insert(users)
    .values({ name, email: email.toLowerCase(), phone, passwordHash, role, referredBy })
    .returning();
  return row;
}

export async function updateUserProfile(id, { name, phone, avatar, addresses }) {
  const patch = { updatedAt: new Date() };
  if (name !== undefined) patch.name = name;
  if (phone !== undefined) patch.phone = phone;
  if (avatar !== undefined) patch.avatarUrl = avatar;
  if (addresses !== undefined) patch.addresses = addresses;
  const [row] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
  return row;
}

export async function updateUserPassword(id, passwordHash) {
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, id));
}

export async function markEmailVerified(id) {
  await db.update(users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, id));
}

export async function setUserActive(id, isActive) {
  const [row] = await db
    .update(users)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return row;
}

export async function setUserRole(id, role) {
  const [row] = await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, id)).returning();
  return row;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export async function registerFailedLogin(id) {
  const [row] = await db
    .update(users)
    .set({ failedLoginAttempts: sql`${users.failedLoginAttempts} + 1` })
    .where(eq(users.id, id))
    .returning();

  if (row && row.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    await db
      .update(users)
      .set({ lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) })
      .where(eq(users.id, id));
  }
  return row;
}

export async function clearFailedLogins(id) {
  await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, id));
}

export async function countAdmins() {
  const [row] = await db.select({ count: count() }).from(users).where(eq(users.role, 'ADMIN'));
  return row?.count ?? 0;
}

// Serializes initial setup so simultaneous no-code requests cannot both
// become the first administrator.
export async function createFirstAdminIfAbsent({ name, email, phone, passwordHash, referredBy }) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(73190542)`);
    const [row] = await tx.select({ total: count() }).from(users).where(eq(users.role, 'ADMIN'));
    if (Number(row?.total || 0) > 0) return null;
    const [user] = await tx.insert(users).values({
      name, email: email.toLowerCase(), phone, passwordHash, role: 'ADMIN', referredBy
    }).returning();
    return user;
  });
}

export async function getReferralStats(userId) {
  const [all] = await db.select({ total: count() }).from(users).where(eq(users.referredBy, userId));
  const [verified] = await db.select({ total: count() }).from(users)
    .where(sql`${users.referredBy} = ${userId} and ${users.emailVerifiedAt} is not null`);
  return { totalReferrals: Number(all?.total || 0), verifiedReferrals: Number(verified?.total || 0) };
}

export async function listUsers({ role } = {}) {
  const query = db.select().from(users);
  if (role) return query.where(eq(users.role, role));
  return query;
}
