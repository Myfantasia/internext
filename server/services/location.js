import countiesData from '../../shared/kenyaCounties.json' with { type: 'json' };

// Reusable location primitives. Delivery pricing, customer profiles and
// county-tagged news all depend on this module — never on each other.

export const KENYA_COUNTIES = countiesData.counties;
const COUNTY_BY_NAME = new Map(KENYA_COUNTIES.map((c) => [c.name.toLowerCase(), c]));

// Generous bounding box around Kenya; rejects swapped lat/lng and 0,0 junk.
const KENYA_BOUNDS = { minLat: -4.9, maxLat: 5.2, minLng: 33.8, maxLng: 42.1 };

export function findCounty(name) {
  if (!name) return null;
  return COUNTY_BY_NAME.get(String(name).trim().toLowerCase()) || null;
}

export function isValidCounty(name) {
  return !!findCounty(name);
}

export function isWithinKenya(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= KENYA_BOUNDS.minLat && lat <= KENYA_BOUNDS.maxLat
    && lng >= KENYA_BOUNDS.minLng && lng <= KENYA_BOUNDS.maxLng;
}

// Parses untrusted { lat, lng } input. Returns null for anything unusable.
export function parseCoordinates(input) {
  if (!input || input.lat == null || input.lng == null || input.lat === '' || input.lng === '') return null;
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!isWithinKenya(lat, lng)) return null;
  // 6 decimals ≈ 11 cm — more precision than that is noise, not information.
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}

// Great-circle distance in kilometres.
export function haversineKm(a, b) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Resolves the best available point for a delivery address: an exact pin if
// one was supplied, otherwise the county HQ (flagged as an estimate).
export function resolveDeliveryPoint({ coordinates, county }) {
  const exact = parseCoordinates(coordinates);
  if (exact) return { point: exact, precision: 'exact' };
  const c = findCounty(county);
  if (c) return { point: { lat: c.lat, lng: c.lng }, precision: 'county' };
  return null;
}

// Normalises Kenyan mobile numbers to 2547XXXXXXXX / 2541XXXXXXXX; null if invalid.
export function normalizeKenyanPhone(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `254${digits.slice(1)}`;
  else if (/^[17]\d{8}$/.test(digits)) digits = `254${digits}`;
  return /^254[17]\d{8}$/.test(digits) ? digits : null;
}

export function maskPhone(msisdn) {
  if (!msisdn || msisdn.length < 6) return null;
  return `${msisdn.slice(0, 4)}******${msisdn.slice(-2)}`;
}
