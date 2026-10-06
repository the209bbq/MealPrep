import { STORE_SEARCH } from '../../config/storeSearch';
import { mapsDirectionsUrl, SMART_SHOP_COPY, SMART_SHOP_STORES } from '../../config/smartShop';
import { geocodeUsZip } from './nominatim';
import { fetchOverpassStores, readCachedOverpassStores } from './overpass';
import { chooseRegionalStaticFallback } from './regionalFallback';
import { loadSavedStoresFallback } from './savedStoresFallback';
import { resolveSearchOriginFast, resolveSearchOriginWithGeocode } from './resolveOrigin';
import { applyOriginDistancesAndSort } from './storeDistance';
import { nearbyStoreSearchRadiusMeters } from './storeSearchRadius';
import { readCachedNearbyStores } from './storeSearchCache';
import { fetchNearbyStoresFromSupabase } from './supabaseNearbyStores';
import { filterCatalogStoresForNearbyList, normalizePipelineOrigin, shouldUseRegionalFallbackForPreview, sortAndLimitStoresForStoresTab } from './storesNearbyPipeline';
import type { NearbyStoreSearchParams, ResolvedGeo, StoreRecord } from './types';

export type { NearbyStoreSearchParams, ResolvedGeo, StoreRecord } from './types';
export { geocodeUsZip, geocodeUsZipOrNull } from './nominatim';
export { mapsDirectionsUrl };
export { resolveSearchOriginFast, readCachedOverpassStores };
export { chooseRegionalStaticFallback, isWithinOakdaleRegionalFallback } from './regionalFallback';
export { nearbyStoreSearchRadiusMeters } from './storeSearchRadius';
export { nearbyStoresCacheGeohash } from './geohash';
function zipGeocodeMessage(reason: string): string {
  switch (reason) {
    case 'not_found':
      return 'Could not find that ZIP code. Check and try again.';
    case 'invalid_zip':
      return 'Enter a valid 5-digit US ZIP code.';
    default:
      return 'ZIP lookup failed. Try another ZIP.';
  }
}

async function geocodeZipForParams(zip: string, useStoresTabZipTable?: boolean) {
  if (useStoresTabZipTable) {
    const { geocodeUsZipForStoresTab } = await import('./storesTabGeocode');
    return geocodeUsZipForStoresTab(zip);
  }
  return geocodeUsZip(zip);
}

export async function resolveSearchOrigin(params: NearbyStoreSearchParams): Promise<ResolvedGeo> {
  const geocodeZip = (zip: string) => geocodeZipForParams(zip, params.useStoresTabZipTable);
  return resolveSearchOriginWithGeocode(params, geocodeZip, zipGeocodeMessage);
}

export type InstantGroceryStorePreview = {
  origin: ResolvedGeo;
  stores: StoreRecord[];
  source: 'cache' | 'saved';
};

/** Cached stores for stale-while-revalidate (no network). */
export function previewNearbyGroceryStores(params: NearbyStoreSearchParams): InstantGroceryStorePreview | null {
  const origin = resolveSearchOriginFast(params);
  if (!origin) return null;

  const originKey = normalizePipelineOrigin(origin);
  const radiusM = nearbyStoreSearchRadiusMeters({
    isGpsOrigin: params.isGpsOrigin,
    radiusMultiplier: params.radiusMultiplier,
  });
  const cached = readCachedNearbyStores(originKey, radiusM);
  if (cached?.length) {
    const filtered = filterCatalogStoresForNearbyList(cached);
    const withUrls = filtered.map((s) => ({ ...s, url: mapsDirectionsUrl(s) }));
    const listed =
      params.displayLimit != null
        ? sortAndLimitStoresForStoresTab(withUrls, origin, params.displayLimit)
        : applyOriginDistancesAndSort(withUrls, origin);
    return {
      origin,
      source: 'cache',
      stores: listed,
    };
  }

  if (STORE_SEARCH.overpassEnabled) {
    const radiusMiles = params.radiusMiles ?? SMART_SHOP_STORES.defaultRadiusMiles;
    const overpassCached = readCachedOverpassStores(origin, radiusMiles);
    if (overpassCached?.length) {
      return {
        origin,
        source: 'cache',
        stores: applyOriginDistancesAndSort(
          overpassCached.map((s) => ({ ...s, url: mapsDirectionsUrl(s) })),
          origin,
        ),
      };
    }
  }

  const saved = loadSavedStoresFallback(params.zip);
  if (saved.length > 0) {
    return {
      origin,
      source: 'saved',
      stores: applyOriginDistancesAndSort(
        saved.map((s) => ({ ...s, url: mapsDirectionsUrl(s) })),
        origin,
      ),
    };
  }

  const regional = chooseRegionalStaticFallback(origin);
  if (regional.length > 0 && shouldUseRegionalFallbackForPreview()) {
    const withUrls = regional.map((s) => ({ ...s, url: mapsDirectionsUrl(s) }));
    const listed =
      params.displayLimit != null
        ? sortAndLimitStoresForStoresTab(withUrls, origin, params.displayLimit)
        : applyOriginDistancesAndSort(withUrls, origin);
    return {
      origin,
      source: 'cache',
      stores: listed,
    };
  }

  return null;
}

function applyCatalogFallback(
  origin: ResolvedGeo,
  params: NearbyStoreSearchParams,
  catalogStores: StoreRecord[],
): StoreRecord[] {
  if (catalogStores.length > 0) return catalogStores;

  const saved = loadSavedStoresFallback(params.zip);
  if (saved.length > 0) return saved;

  return chooseRegionalStaticFallback(origin);
}

export async function searchNearbyGroceryStores(params: NearbyStoreSearchParams): Promise<{
  origin: ResolvedGeo;
  stores: StoreRecord[];
  osmWarning?: string;
  storeSearchFailed?: boolean;
  canWidenSearch?: boolean;
}> {
  const origin = await resolveSearchOrigin(params);
  const radiusM = nearbyStoreSearchRadiusMeters({
    isGpsOrigin: params.isGpsOrigin,
    radiusMultiplier: params.radiusMultiplier,
  });

  let catalogStores: StoreRecord[] = [];
  let catalogWarning: string | undefined;
  let catalogFailed = false;

  const supabase = await fetchNearbyStoresFromSupabase(origin, {
    radiusM,
    limit: STORE_SEARCH.nearbyRpcLimit,
  });

  if (supabase.ok) {
    catalogStores = filterCatalogStoresForNearbyList(supabase.stores);
    if (supabase.fromCache) {
      catalogWarning = SMART_SHOP_COPY.osmNetworkRetry;
    }
  } else if (supabase.reason === 'unconfigured' || supabase.reason === 'error') {
    catalogFailed = true;
    catalogWarning = SMART_SHOP_COPY.osmNetwork;
  } else if (supabase.reason === 'empty') {
    catalogFailed = false;
  }

  if (catalogStores.length === 0 && STORE_SEARCH.overpassEnabled) {
    const overpass = await fetchOverpassStores(origin, params);
    if (overpass.ok) {
      catalogStores = overpass.stores;
      if (overpass.fromStaleCache) catalogWarning = SMART_SHOP_COPY.osmNetworkRetry;
      catalogFailed = false;
    } else if (!catalogWarning) {
      catalogWarning =
        overpass.reason === 'rate_limited'
          ? SMART_SHOP_COPY.osmRateLimited
          : overpass.reason === 'empty'
            ? SMART_SHOP_COPY.osmEmpty
            : SMART_SHOP_COPY.osmNetwork;
      catalogFailed = true;
    }
  }

  const merged = applyCatalogFallback(origin, params, catalogStores);
  const hadCatalog = catalogStores.length > 0;
  const storeSearchFailed = merged.length === 0 && catalogFailed;
  const canWidenSearch =
    !hadCatalog && merged.length === 0 && (params.radiusMultiplier ?? 1) === 1;

  if (!hadCatalog && merged.length > 0) {
    catalogWarning = SMART_SHOP_COPY.osmNetworkRetry;
  }

  return {
    origin,
    osmWarning: catalogWarning,
    storeSearchFailed,
    canWidenSearch,
    stores: applyOriginDistancesAndSort(
      merged.map((s) => ({
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
