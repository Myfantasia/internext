import { eq, sql, count } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { parseCoordinates } from '../services/location.js';

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
  const {
    passwordHash, failedLoginAttempts, lockedUntil, updatedAt, avatarUrl,
    referralCode, referredBy, county, town, addressLine, locationLat, locationLng, locationSource,
    ...safe
  } = row;
  return {
    ...safe,
    avatar: avatarUrl,
    location: county ? {
      county,
      town,
      addressLine,
      lat: locationLat != null ? Number(locationLat) : null,
      lng: locationLng != null ? Number(locationLng) : null,
      source: locationSource
    } : null
  };
}

// Maps validated location input (schemas/authSchemas.js locationSchema) to columns.
export function locationColumns(location) {
  if (!location) return {};
  const coords = parseCoordinates({ lat: location.lat, lng: location.lng });
  return {
    county: location.county,
    town: location.town,
    addressLine: location.addressLine || null,
    locationLat: coords ? String(coords.lat) : null,
    locationLng: coords ? String(coords.lng) : null,
    locationSource: coords ? (location.source === 'gps' ? 'gps' : 'map') : 'manual'
  };
}

export async function findUserByEmail(email) {
  const [row] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return row || null;
}

// Phones are stored normalized (2547XXXXXXXX) so "0712…" and "+254 712…" match.
export async function findUserByPhone(phone) {
  if (!phone) return null;
  const [row] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  return row || null;
}

// Maps a Postgres unique violation on users to the field that clashed, so a
// race between two signups still produces a clear message. Drizzle may wrap
// the driver error, hence the `cause` check.
export function duplicateUserField(err) {
  const e = err?.code === '23505' ? err : err?.cause?.code === '23505' ? err.cause : null;
  if (!e) return null;
  const name = e.constraint_name || e.constraint || '';
  if (name.includes('phone')) return 'phone';
  if (name.includes('email')) return 'email';
  return 'unknown';
}

export async function findUserById(id) {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row || null;
}

export async function createUser({ name, email, phone, passwordHash, role = 'CUSTOMER', referredBy = null, location = null }, tx = db) {
  const [row] = await tx
    .insert(users)
    .values({ name, email: email.toLowerCase(), phone, passwordHash, role, referredBy, ...locationColumns(location) })
    .returning();
  return row;
}

export async function updateUserProfile(id, { name, phone, avatar, addresses, location }) {
  const patch = { updatedAt: new Date(), ...locationColumns(location) };
  if (name !== undefined) patch.name = name;
  if (phone !== undefined) patch.phone = phone;
  if (avatar !== undefined) patch.avatarUrl = avatar;
  if (addresses !== undefined) patch.addresses = addresses;
  const [row] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
  return row;
}

// A new address must be proven again, so verification is reset.
export async function updateUserEmail(id, email) {
  const [row] = await db.update(users).set({ email: email.toLowerCase(), emailVerifiedAt: null, updatedAt: new Date() })
    .where(eq(users.id, id)).returning();
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
