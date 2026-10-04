import { STORE_SEARCH } from '../../config/storeSearch';
import { haversineMiles, milesToMeters, SMART_SHOP_STORES } from '../../config/smartShop';
import { readCache, writeCache } from './cache';
import {
  buildOverpassGroceryQuery,
  dedupeGroceryStoresByName,
  haystackFromTags,
  isAllowedOsmGroceryElement,
  rankGroceryStores,
  resolveGroceryChainFromHaystack,
} from './groceryFilter';
import { readPersistentCache, readPersistentCacheStale, writePersistentCache } from './osmPersistentCache';
import { raceOverpassMirrors } from './overpassFetch';
import { enrichStoreAddressFields, parseOsmAddressTags } from './osmStoreAddress';
import { storeRecordExtrasFromOsmTags } from './storeLinks';
import type { NearbyStoreSearchParams, StoreRecord } from './types';

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export type OverpassFetchResult =
  | { ok: true; stores: StoreRecord[]; fromStaleCache?: boolean; fromCache?: boolean }
  | { ok: false; reason: 'rate_limited' | 'network' | 'empty' };

export function overpassCacheKey(origin: { lat: number; lng: number }, radiusMiles: number): string {
  return `overpass:v2:${origin.lat.toFixed(3)}:${origin.lng.toFixed(3)}:${radiusMiles}`;
}

export function readCachedOverpassStores(
  origin: { lat: number; lng: number },
  radiusMiles: number,
): StoreRecord[] | undefined {
  const cacheKey = overpassCacheKey(origin, radiusMiles);
  const memoryCached = readCache<StoreRecord[]>(cacheKey);
  if (memoryCached?.length) return memoryCached;

  const persistentCached = readPersistentCache<StoreRecord[]>(cacheKey);
  if (persistentCached?.length) {
    writeCache(cacheKey, persistentCached, SMART_SHOP_STORES.cacheTtlMs);
    return persistentCached;
  }

  return undefined;
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
    const addr = enrichStoreAddressFields(parseOsmAddressTags(tags), lat, lng);
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
      osmShop: tags.shop?.trim() || undefined,
      url: undefined,
      ...storeRecordExtrasFromOsmTags(tags),
    });
  }

  const deduped = dedupeGroceryStoresByName(stores);
  return rankGroceryStores(deduped);
}

export type FetchOverpassStoresOptions = {
  /** When true, skip live Overpass and only return persistent / memory cache. */
  cacheOnly?: boolean;
};

export async function fetchOverpassStores(
  origin: { lat: number; lng: number },
  params: NearbyStoreSearchParams,
  options?: FetchOverpassStoresOptions,
): Promise<OverpassFetchResult> {
  if (!STORE_SEARCH.overpassEnabled) {
    return { ok: false, reason: 'network' };
  }
  const radiusMiles = params.radiusMiles ?? SMART_SHOP_STORES.defaultRadiusMiles;
  const radiusMeters = Math.round(milesToMeters(radiusMiles));
  const cacheKey = overpassCacheKey(origin, radiusMiles);

  const cached = readCachedOverpassStores(origin, radiusMiles);
  if (cached?.length) {
    if (options?.cacheOnly) {
      return { ok: true, stores: cached, fromCache: true };
    }
  }

  if (options?.cacheOnly) {
    const stale = readPersistentCacheStale<StoreRecord[]>(cacheKey);
    if (stale?.length) {
      writeCache(cacheKey, stale, SMART_SHOP_STORES.cacheTtlMs);
      return { ok: true, stores: stale, fromStaleCache: true, fromCache: true };
    }
    return { ok: false, reason: 'network' };
  }

  const query = buildOverpassGroceryQuery(
    origin.lat,
    origin.lng,
    radiusMeters,
    SMART_SHOP_STORES.maxOverpassResults,
  );

  const fetched = await raceOverpassMirrors(query);
  if ('reason' in fetched) {
    const stale = readPersistentCacheStale<StoreRecord[]>(cacheKey);
    if (stale?.length) {
      writeCache(cacheKey, stale, SMART_SHOP_STORES.cacheTtlMs);
      return { ok: true, stores: stale, fromStaleCache: true };
    }
    if (cached?.length) {
      return { ok: true, stores: cached, fromStaleCache: true, fromCache: true };
    }
    return { ok: false, reason: fetched.reason };
  }

  const ranked = elementsToStores(fetched.elements as OverpassElement[], origin, params);
  if (ranked.length === 0) {
    if (cached?.length) {
      return { ok: true, stores: cached, fromStaleCache: true, fromCache: true };
    }
    return { ok: false, reason: 'empty' };
  }

  writeCache(cacheKey, ranked, SMART_SHOP_STORES.cacheTtlMs);
  writePersistentCache(cacheKey, ranked, SMART_SHOP_STORES.overpassPersistentTtlMs);
  return { ok: true, stores: ranked };
}
