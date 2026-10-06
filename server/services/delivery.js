import { asc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { deliveryRateBands, deliveryZones } from '../db/schema.js';
import { getCompanyProfile } from '../repositories/companyProfileRepo.js';
import { haversineKm, resolveDeliveryPoint } from './location.js';

// Delivery pricing: distance bands measured from the office, plus fixed
// options (store pickup, special flat rates). The server computes every quote;
// the browser only ever displays what this returns.

export class DeliveryError extends Error {
  constructor(message, code = 'DELIVERY_UNAVAILABLE') {
    super(message);
    this.status = 400;
    this.code = code;
  }
}

const num = (v) => (v == null ? null : Number(v));

export function toApiBand(b) {
  return {
    id: b.id, name: b.name, description: b.description,
    minKm: num(b.minKm), maxKm: num(b.maxKm), fee: num(b.fee), freeThreshold: num(b.freeThreshold),
    estimatedTime: b.estimatedTime, isActive: b.isActive, sortOrder: b.sortOrder
  };
}

export function toApiOption(z) {
  return {
    id: z.id, name: z.name, kind: z.kind, description: z.description, fee: num(z.fee),
    freeThreshold: num(z.freeThreshold), estimatedTime: z.estimatedTime, isActive: z.isActive, sortOrder: z.sortOrder
  };
}

export async function getDeliveryConfig({ includeInactive = false } = {}) {
  const [profile, bands, options] = await Promise.all([
    getCompanyProfile(),
    db.select().from(deliveryRateBands).orderBy(asc(deliveryRateBands.minKm)),
    db.select().from(deliveryZones).orderBy(asc(deliveryZones.sortOrder), asc(deliveryZones.name))
  ]);
  return {
    office: profile?.officeLat != null && profile?.officeLng != null
      ? { lat: Number(profile.officeLat), lng: Number(profile.officeLng), address: profile.address }
      : null,
    roadDistanceFactor: Number(profile?.roadDistanceFactor ?? 1.3),
    outOfRangeFee: num(profile?.outOfRangeFee),
    bands: bands.filter((b) => includeInactive || b.isActive).map(toApiBand),
    options: options.filter((o) => includeInactive || o.isActive).map(toApiOption)
  };
}

function applyFreeThreshold(fee, freeThreshold, subtotal) {
  return freeThreshold != null && freeThreshold > 0 && subtotal >= freeThreshold ? 0 : fee;
}

// request: { mode: 'distance' | 'option', optionId?, coordinates?: {lat,lng}, county? }
export async function quoteDelivery(request, subtotal, config) {
  const cfg = config || (await getDeliveryConfig());
  const mode = request?.mode;

  if (mode === 'option') {
    const option = cfg.options.find((o) => o.id === request.optionId);
    if (!option) throw new DeliveryError('That delivery option is no longer available. Please choose another.');
    return {
      mode: 'option',
      optionId: option.id,
      kind: option.kind,
      label: option.name,
      fee: applyFreeThreshold(option.fee, option.freeThreshold, subtotal),
      baseFee: option.fee,
      estimatedTime: option.estimatedTime,
      distanceKm: null,
      estimated: false
    };
  }

  if (mode !== 'distance') throw new DeliveryError('Choose how you would like to receive your order.');
  if (!cfg.office) throw new DeliveryError('Distance-based delivery is not configured yet. Please choose store pickup.', 'DELIVERY_NOT_CONFIGURED');

  const resolved = resolveDeliveryPoint({ coordinates: request.coordinates, county: request.county });
  if (!resolved) throw new DeliveryError('We need your delivery location: pin it on the map or choose your county.', 'LOCATION_REQUIRED');

  const straightKm = haversineKm(cfg.office, resolved.point);
  // Rounded to 0.1 km: precise enough for pricing without echoing exact coordinates.
  const distanceKm = Math.round(straightKm * cfg.roadDistanceFactor * 10) / 10;
  const band = cfg.bands.find((b) => distanceKm >= b.minKm && (b.maxKm == null || distanceKm < b.maxKm));

  if (!band) {
    if (cfg.outOfRangeFee == null) {
      throw new DeliveryError(`Your location (about ${distanceKm} km away) is outside our delivery range. Please choose store pickup or contact us for a quote.`, 'OUT_OF_RANGE');
    }
    return {
      mode: 'distance', bandId: null, label: 'Outside standard delivery range', fee: cfg.outOfRangeFee, baseFee: cfg.outOfRangeFee,
      estimatedTime: 'We will call to confirm timing', distanceKm, estimated: resolved.precision !== 'exact', precision: resolved.precision
    };
  }

  return {
    mode: 'distance',
    bandId: band.id,
    label: band.name,
    fee: applyFreeThreshold(band.fee, band.freeThreshold, subtotal),
    baseFee: band.fee,
    freeThreshold: band.freeThreshold,
    estimatedTime: band.estimatedTime,
    distanceKm,
    estimated: resolved.precision !== 'exact',
    precision: resolved.precision
  };
}

// --- Admin writes ----------------------------------------------------------

export async function saveBand(id, data) {
  const values = {
    name: data.name, description: data.description || null,
    minKm: String(data.minKm), maxKm: data.maxKm == null ? null : String(data.maxKm),
    fee: String(data.fee), freeThreshold: data.freeThreshold == null ? null : String(data.freeThreshold),
    estimatedTime: data.estimatedTime || null, isActive: data.isActive, sortOrder: data.sortOrder ?? 0
  };
  if (id) {
    const [row] = await db.update(deliveryRateBands).set({ ...values, updatedAt: new Date() }).where(eq(deliveryRateBands.id, id)).returning();
    return row ? toApiBand(row) : null;
  }
  const [row] = await db.insert(deliveryRateBands).values(values).returning();
  return toApiBand(row);
}

export async function deleteBand(id) {
  const [row] = await db.delete(deliveryRateBands).where(eq(deliveryRateBands.id, id)).returning();
  return row || null;
}

export async function saveOption(id, data) {
  const values = {
    name: data.name, kind: data.kind, description: data.description || null, fee: String(data.fee),
    freeThreshold: data.freeThreshold == null ? null : String(data.freeThreshold),
    estimatedTime: data.estimatedTime || null, isActive: data.isActive, sortOrder: data.sortOrder ?? 0
  };
  if (id) {
    const [row] = await db.update(deliveryZones).set(values).where(eq(deliveryZones.id, id)).returning();
    return row ? toApiOption(row) : null;
  }
  const [row] = await db.insert(deliveryZones).values(values).returning();
  return toApiOption(row);
}

export async function deleteOption(id) {
  const [row] = await db.delete(deliveryZones).where(eq(deliveryZones.id, id)).returning();
  return row || null;
}

// Overlapping active bands make pricing ambiguous — reject them at save time.
export function findBandOverlap(bands) {
  const active = bands.filter((b) => b.isActive).sort((a, b) => a.minKm - b.minKm);
  for (let i = 1; i < active.length; i += 1) {
    const prev = active[i - 1];
    if (prev.maxKm == null || active[i].minKm < prev.maxKm) return [prev, active[i]];
  }
  return null;
}
