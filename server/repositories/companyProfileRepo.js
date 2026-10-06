import { db } from '../db/client.js';
import { companyProfile, deliveryZones, stores } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Singleton-style table — there is exactly one active row.
// Pass the transaction when calling from inside one: on Vercel the pool has a
// single connection, so reaching for `db` mid-transaction waits forever.
export async function getCompanyProfile(database = db) {
  const [row] = await database.select().from(companyProfile).limit(1);
  return row || null;
}

export async function updateCompanyProfile(patch) {
  const existing = await getCompanyProfile();
  if (!existing) {
    const [row] = await db.insert(companyProfile).values(patch).returning();
    return row;
  }
  const [row] = await db
    .update(companyProfile)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(companyProfile.id, existing.id))
    .returning();
  return row;
}

export async function listDeliveryZones() {
  return db.select().from(deliveryZones);
}

export async function replaceDeliveryZones(zones) {
  await db.delete(deliveryZones);
  if (zones.length) await db.insert(deliveryZones).values(zones);
  return listDeliveryZones();
}

export async function findDeliveryZoneById(id) {
  const [row] = await db.select().from(deliveryZones).where(eq(deliveryZones.id, id)).limit(1);
  return row || null;
}

export async function listStores() {
  return db.select().from(stores);
}

export async function replaceStores(rows) {
  await db.delete(stores);
  if (rows.length) await db.insert(stores).values(rows);
  return listStores();
}
