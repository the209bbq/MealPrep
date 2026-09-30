import { haversineMiles, milesToMeters, SMART_SHOP_STORES } from '../../config/smartShop';
import { readCache, writeCache } from './cache';
import type { NearbyStoreSearchParams, StoreRecord } from './types';

const SHOP_TAGS = ['supermarket', 'grocery', 'convenience'] as const;

function parseAddress(tags: Record<string, string>): {
  addressLine: string;
  city: string;
  state: string;
  zip: string;
} {
  const housenumber = tags['addr:housenumber'] ?? '';
  const street = tags['addr:street'] ?? tags['addr:place'] ?? '';
  const addressLine = [housenumber, street].filter(Boolean).join(' ').trim() || tags['addr:full'] || 'Address not listed';
  const city = tags['addr:city'] ?? tags['addr:town'] ?? tags['addr:village'] ?? '';
  const state = tags['addr:state'] ?? '';
  const zip = tags['addr:postcode'] ?? '';
  return { addressLine, city, state, zip };
}

function storeName(tags: Record<string, string>): string {
  return tags.name ?? tags.brand ?? tags.operator ?? 'Grocery store';
}

function buildOverpassQuery(lat: number, lng: number, radiusMeters: number): string {
  const filters = SHOP_TAGS.map((shop) => `node["shop"="${shop}"](around:${radiusMeters},${lat},${lng});`).join('\n');
  return `[out:json][timeout:25];
(
${filters}
way["shop"="supermarket"](around:${radiusMeters},${lat},${lng});
way["shop"="grocery"](around:${radiusMeters},${lat},${lng});
);
out center ${SMART_SHOP_STORES.maxOverpassResults};`;
}

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export async function fetchOverpassStores(
  origin: { lat: number; lng: number },
  params: NearbyStoreSearchParams,
): Promise<StoreRecord[]> {
  const radiusMiles = params.radiusMiles ?? SMART_SHOP_STORES.defaultRadiusMiles;
  const radiusMeters = Math.round(milesToMeters(radiusMiles));
  const cacheKey = `overpass:${origin.lat.toFixed(3)}:${origin.lng.toFixed(3)}:${radiusMiles}`;
  const cached = readCache<StoreRecord[]>(cacheKey);
  if (cached) return cached;

  const query = buildOverpassQuery(origin.lat, origin.lng, radiusMeters);
  const response = await fetch(SMART_SHOP_STORES.overpassApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': SMART_SHOP_STORES.httpUserAgent,
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`OpenStreetMap store search failed (${response.status}). Try again in a minute.`);
  }

  const json = (await response.json()) as { elements?: OverpassElement[] };
  const elements = json.elements ?? [];
  const stores: StoreRecord[] = [];

  for (const el of elements) {
    const tags = el.tags ?? {};
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;

    const name = storeName(tags);
    const chain = tags.brand ?? tags.operator ?? name;
    const addr = parseAddress(tags);
    const id = `osm-${el.type}-${el.id}`;
    const distanceMiles = haversineMiles(origin, { lat, lng });

    stores.push({
      id,
      name,
      chain,
      addressLine: addr.addressLine,
      city: addr.city,
      state: addr.state,
      zip: addr.zip || params.zip?.slice(0, 5) || '',
      lat,
      lng,
      distanceMiles: Math.round(distanceMiles * 100) / 100,
      source: 'osm',
      pricingSource: 'none',
      url: undefined,
    });
  }

  const deduped = dedupeByProximity(stores);
  deduped.sort((a, b) => (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99));

  writeCache(cacheKey, deduped, SMART_SHOP_STORES.cacheTtlMs);
  return deduped;
}

function dedupeByProximity(stores: StoreRecord[]): StoreRecord[] {
  const kept: StoreRecord[] = [];
  for (const store of stores) {
    const duplicate = kept.find(
      (k) =>
        k.name.toLowerCase() === store.name.toLowerCase() &&
        (k.distanceMiles ?? 0) - (store.distanceMiles ?? 0) < 0.05,
    );
    if (!duplicate) kept.push(store);
  }
  return kept;
}
