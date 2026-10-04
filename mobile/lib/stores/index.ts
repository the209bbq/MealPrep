import { mapsDirectionsUrl, SMART_SHOP_COPY, SMART_SHOP_STORES } from '../../config/smartShop';
import { geocodeUsZip } from './nominatim';
import { fetchOverpassStores, readCachedOverpassStores } from './overpass';
import { loadSavedStoresFallback } from './savedStoresFallback';
import { resolveSearchOriginFast, resolveSearchOriginWithGeocode } from './resolveOrigin';
import { applyOriginDistancesAndSort } from './storeDistance';
import type { NearbyStoreSearchParams, ResolvedGeo, StoreRecord } from './types';

export type { NearbyStoreSearchParams, ResolvedGeo, StoreRecord } from './types';
export { geocodeUsZip, geocodeUsZipOrNull } from './nominatim';
export { mapsDirectionsUrl };
export { resolveSearchOriginFast, readCachedOverpassStores };

function zipGeocodeMessage(reason: string): string {
  switch (reason) {
    case 'rate_limited':
      return 'ZIP lookup is rate-limited. Try “Use my location” or wait a minute.';
    case 'not_found':
      return 'Could not find that ZIP code. Check and try again.';
    case 'invalid_zip':
      return 'Enter a valid 5-digit US ZIP code.';
    default:
      return 'ZIP lookup failed. Try “Use my location”.';
  }
}

function overpassWarning(reason: string): string | undefined {
  switch (reason) {
    case 'rate_limited':
      return SMART_SHOP_COPY.osmRateLimited;
    case 'network':
      return SMART_SHOP_COPY.osmNetwork;
    case 'empty':
      return SMART_SHOP_COPY.osmEmpty;
    default:
      return undefined;
  }
}

export async function resolveSearchOrigin(params: NearbyStoreSearchParams): Promise<ResolvedGeo> {
  return resolveSearchOriginWithGeocode(params, geocodeUsZip, zipGeocodeMessage);
}

export type InstantGroceryStorePreview = {
  origin: ResolvedGeo;
  stores: StoreRecord[];
  source: 'cache' | 'saved';
};

/** Cached or saved stores for stale-while-revalidate (no network). */
export function previewNearbyGroceryStores(params: NearbyStoreSearchParams): InstantGroceryStorePreview | null {
  const origin = resolveSearchOriginFast(params);
  if (!origin) return null;

  const radiusMiles = params.radiusMiles ?? SMART_SHOP_STORES.defaultRadiusMiles;
  const cached = readCachedOverpassStores(origin, radiusMiles);
  if (cached?.length) {
    return {
      origin,
      source: 'cache',
      stores: applyOriginDistancesAndSort(
        cached.map((s) => ({ ...s, url: mapsDirectionsUrl(s) })),
        origin,
      ),
    };
  }

  const fallback = loadSavedStoresFallback(params.zip);
  if (fallback.length > 0) {
    return {
      origin,
      source: 'saved',
      stores: applyOriginDistancesAndSort(
        fallback.map((s) => ({ ...s, url: mapsDirectionsUrl(s) })),
        origin,
      ),
    };
  }

  return null;
}

function applyOsmResult(
  overpass: Awaited<ReturnType<typeof fetchOverpassStores>>,
  params: NearbyStoreSearchParams,
): { osmStores: StoreRecord[]; osmWarning?: string } {
  let osmStores: StoreRecord[] = overpass.ok ? overpass.stores : [];
  let osmWarning: string | undefined;

  if (overpass.ok && overpass.fromStaleCache) {
    osmWarning = SMART_SHOP_COPY.osmNetworkRetry;
  } else if (!overpass.ok) {
    osmWarning = overpassWarning(overpass.reason);
  }

  if (osmStores.length === 0) {
    const fallback = loadSavedStoresFallback(params.zip);
    if (fallback.length > 0) {
      osmStores = fallback;
      osmWarning = SMART_SHOP_COPY.osmNetworkRetry;
    }
  }

  return { osmStores, osmWarning };
}

export async function searchNearbyGroceryStores(params: NearbyStoreSearchParams): Promise<{
  origin: ResolvedGeo;
  stores: StoreRecord[];
  osmWarning?: string;
  storeSearchFailed?: boolean;
}> {
  const origin = await resolveSearchOrigin(params);
  const overpass = await fetchOverpassStores(origin, params);
  const { osmStores, osmWarning } = applyOsmResult(overpass, params);

  const storeSearchFailed = !overpass.ok && osmStores.length === 0;

  return {
    origin,
    osmWarning,
    storeSearchFailed,
    stores: applyOriginDistancesAndSort(
      osmStores.map((s) => ({
        ...s,
        url: mapsDirectionsUrl(s),
      })),
      origin,
    ),
  };
}

export function manualStoreFromInput(input: {
  name: string;
  addressLine: string;
  city: string;
  state: string;
  zip: string;
}): StoreRecord {
  const key = `${input.name}-${input.zip}`.toLowerCase().replace(/\s+/g, '-');
  const store: StoreRecord = {
    id: `manual-${key}`,
    name: input.name.trim(),
    chain: input.name.trim(),
    addressLine: input.addressLine.trim(),
    city: input.city.trim(),
    state: input.state.trim(),
    zip: input.zip.trim().slice(0, 10),
    source: 'manual',
    pricingSource: 'none',
  };
  return { ...store, url: mapsDirectionsUrl(store) };
}

export function limitFavoriteStores(stores: StoreRecord[]): StoreRecord[] {
  return stores.slice(0, SMART_SHOP_STORES.maxSavedStores);
}
