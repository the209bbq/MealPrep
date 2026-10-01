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
import { isRateLimitedStatus, osmRequestHeaders } from './osmHttp';
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
  | { ok: true; stores: StoreRecord[] }
  | { ok: false; reason: 'rate_limited' | 'network' | 'empty' };

export async function fetchOverpassStores(
  origin: { lat: number; lng: number },
  params: NearbyStoreSearchParams,
): Promise<OverpassFetchResult> {
  const radiusMiles = params.radiusMiles ?? SMART_SHOP_STORES.defaultRadiusMiles;
  const radiusMeters = Math.round(milesToMeters(radiusMiles));
  const cacheKey = `overpass:v2:${origin.lat.toFixed(3)}:${origin.lng.toFixed(3)}:${radiusMiles}`;
  const cached = readCache<StoreRecord[]>(cacheKey);
  if (cached) return { ok: true, stores: cached };

  const query = buildOverpassGroceryQuery(
    origin.lat,
    origin.lng,
    radiusMeters,
    SMART_SHOP_STORES.maxOverpassResults,
  );

  try {
    const response = await fetch(SMART_SHOP_STORES.overpassApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...osmRequestHeaders(),
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (isRateLimitedStatus(response.status)) {
      return { ok: false, reason: 'rate_limited' };
    }
    if (!response.ok) {
      return { ok: false, reason: 'network' };
    }

    const json = (await response.json()) as { elements?: OverpassElement[] };
    const elements = json.elements ?? [];
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
    const ranked = rankGroceryStores(deduped);

    if (ranked.length === 0) return { ok: false, reason: 'empty' };

    writeCache(cacheKey, ranked, SMART_SHOP_STORES.cacheTtlMs);
    return { ok: true, stores: ranked };
  } catch {
    return { ok: false, reason: 'network' };
  }
}
