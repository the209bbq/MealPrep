/** Smart Shop — public config only (no secrets). */

export const SMART_SHOP_STORES = {
  defaultRadiusMiles: 15,
  maxSavedStores: 8,
  maxOverpassResults: 40,
  /** Native clients: Nominatim / Overpass usage policy User-Agent. */
  httpUserAgent: '209MealPrep/1.0 Smart Shop (https://github.com/the209bbq/MealPrep)',
  /** Web / fallback: Nominatim requires a contact email in the request (cannot set User-Agent in browsers). */
  nominatimContactEmail: 'smartshop@209mealprep.local',
  nominatimBaseUrl: 'https://nominatim.openstreetmap.org',
  overpassApiUrl: 'https://overpass-api.de/api/interpreter',
  /** In-memory cache TTL for geocode / Overpass (ms). */
  cacheTtlMs: 15 * 60 * 1000,
  /** Merge Kroger location rows within this distance (miles). */
  krogerMergeRadiusMiles: 0.35,
} as const;

export const KROGER_CHAINS = [
  'Kroger',
  'Ralphs',
  'Food 4 Less',
  'Fred Meyer',
  'Smiths',
  "Smith's",
  'Fry’s',
  'Frys',
  'QFC',
  'King Soopers',
  'Mariano’s',
  'Marianos',
  'Pick n Save',
  'Metro Market',
  'Harris Teeter',
  'Dillons',
  'Baker’s',
  'Bakers',
  'Gerbes',
  'Jay C',
  'Pay Less',
  'Ruler',
] as const;

export function milesToMeters(miles: number): number {
  return miles * 1609.344;
}

export function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.7613;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function mapsDirectionsUrl(store: {
  name: string;
  addressLine: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
}): string {
  if (store.lat != null && store.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`;
  }
  const q = [store.name, store.addressLine, store.city, store.state, store.zip].filter(Boolean).join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}
