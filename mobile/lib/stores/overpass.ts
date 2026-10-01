import { haversineMiles, milesToMeters, SMART_SHOP_STORES } from '../../config/smartShop';
import { withTimeout } from '../withTimeout';
import { readCache, writeCache } from './cache';
import {
  buildOverpassGroceryQuery,
  dedupeGroceryStoresByName,
  haystackFromTags,
  isAllowedOsmGroceryElement,
  rankGroceryStores,
  resolveGroceryChainFromHaystack,
} from './groceryFilter';
import { isRateLimitedStatus, osmRequestHeaders } from './osmHttp';
import { readPersistentCache, readPersistentCacheStale, writePersistentCache } from './osmPersistentCache';
import type { NearbyStoreSearchParams, StoreRecord } from './types';

function parseAddress(tags: Record<string, string>): {
  addressLine: string;
  city: string;
  state: string;
  zip: string;
} {
  const housenumber = tags['addr:housenumber'] ?? '';
  const street = tags['addr:street'] ?? tags['addr:place'] ?? '';
  const addressLine = [housenumber, street].filter(Boolean).join(' ').trim() || tags['addr:full'] || '';
  const city = tags['addr:city'] ?? tags['addr:town'] ?? tags['addr:village'] ?? '';
  const state = tags['addr:state'] ?? '';
  const zip = tags['addr:postcode'] ?? '';
  return { addressLine, city, state, zip };
}

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export type OverpassFetchResult =
  | { ok: true; stores: StoreRecord[]; fromStaleCache?: boolean }
  | { ok: false; reason: 'rate_limited' | 'network' | 'empty' };

function overpassCacheKey(origin: { lat: number; lng: number }, radiusMiles: number): string {
  return `overpass:v2:${origin.lat.toFixed(3)}:${origin.lng.toFixed(3)}:${radiusMiles}`;
}

function elementsToStores(
  elements: OverpassElement[],
  origin: { lat: number; lng: number },
  params: NearbyStoreSearchParams,
): StoreRecord[] {
  const stores: StoreRecord[] = [];

  for (const el of elements) {
    const tags = el.tags ?? {};
    if (!isAllowedOsmGroceryElement(tags)) continue;

    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;

    const name = tags.name!.trim();
    const haystack = haystackFromTags(tags);
    const known = resolveGroceryChainFromHaystack(haystack);
    const chain = known?.displayName ?? tags.brand ?? tags.operator ?? name;
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

  const deduped = dedupeGroceryStoresByName(stores);
  return rankGroceryStores(deduped);
}

async function postOverpassQuery(query: string, endpoint: string): Promise<Response> {
  const fetchPromise = fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...osmRequestHeaders(),
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  return withTimeout(
    fetchPromise,
    SMART_SHOP_STORES.overpassRequestTimeoutMs,
    `Overpass request timed out (${endpoint})`,
  );
}

async function fetchOverpassElements(
  query: string,
): Promise<{ elements: OverpassElement[] } | { reason: 'rate_limited' | 'network' }> {
  let lastNetwork = true;
  for (const endpoint of SMART_SHOP_STORES.overpassApiUrls) {
    try {
      const response = await postOverpassQuery(query, endpoint);
      if (isRateLimitedStatus(response.status)) {
        lastNetwork = false;
        continue;
      }
      if (!response.ok) {
        continue;
      }
      const json = (await response.json()) as { elements?: OverpassElement[] };
      return { elements: json.elements ?? [] };
    } catch {
      continue;
    }
  }
  return { reason: lastNetwork ? 'network' : 'rate_limited' };
}

export async function fetchOverpassStores(
  origin: { lat: number; lng: number },
  params: NearbyStoreSearchParams,
): Promise<OverpassFetchResult> {
  const radiusMiles = params.radiusMiles ?? SMART_SHOP_STORES.defaultRadiusMiles;
  const radiusMeters = Math.round(milesToMeters(radiusMiles));
  const cacheKey = overpassCacheKey(origin, radiusMiles);

  const memoryCached = readCache<StoreRecord[]>(cacheKey);
  if (memoryCached?.length) return { ok: true, stores: memoryCached };

  const persistentCached = readPersistentCache<StoreRecord[]>(cacheKey);
  if (persistentCached?.length) {
    writeCache(cacheKey, persistentCached, SMART_SHOP_STORES.cacheTtlMs);
    return { ok: true, stores: persistentCached };
  }

  const query = buildOverpassGroceryQuery(
    origin.lat,
    origin.lng,
    radiusMeters,
    SMART_SHOP_STORES.maxOverpassResults,
  );

  const fetched = await fetchOverpassElements(query);
  if ('reason' in fetched) {
    const stale = readPersistentCacheStale<StoreRecord[]>(cacheKey);
    if (stale?.length) {
      writeCache(cacheKey, stale, SMART_SHOP_STORES.cacheTtlMs);
      return { ok: true, stores: stale, fromStaleCache: true };
    }
    return { ok: false, reason: fetched.reason };
  }

  const ranked = elementsToStores(fetched.elements, origin, params);
  if (ranked.length === 0) return { ok: false, reason: 'empty' };

  writeCache(cacheKey, ranked, SMART_SHOP_STORES.cacheTtlMs);
  writePersistentCache(cacheKey, ranked, SMART_SHOP_STORES.overpassPersistentTtlMs);
  return { ok: true, stores: ranked };
}
