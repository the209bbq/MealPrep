import { lookupLocalZipGeocode } from './localZipTable';
import { readCache } from './cache';
import { readPersistentCache } from './osmPersistentCache';
import type { GeocodedPoint } from './nominatim';
import { placeLabelFromGeocodePoint } from './zipPlaceParse';
import type { NearbyStoreSearchParams, ResolvedGeo } from './types';
function zipGeocodeCacheKey(zip: string): string {
  return `zcta:zip:${zip}`;
}

function readCachedZipPoint(zip: string): GeocodedPoint | undefined {
  const normalized = zip.trim().slice(0, 5);
  const cacheKey = zipGeocodeCacheKey(normalized);
  const memory = readCache<GeocodedPoint>(cacheKey);
  if (memory) return memory;
  return readPersistentCache<GeocodedPoint>(cacheKey);
}

/** Resolve search origin without network when coords or ZIP are already known locally. */
export function resolveSearchOriginFast(params: NearbyStoreSearchParams): ResolvedGeo | undefined {
  if (
    params.lat != null &&
    params.lng != null &&
    Number.isFinite(params.lat) &&
    Number.isFinite(params.lng)
  ) {
    return { lat: params.lat, lng: params.lng, label: 'your location' };
  }

  if (!params.zip) return undefined;
  const zip = params.zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(zip)) return undefined;

  const local = lookupLocalZipGeocode(zip);
  if (local) {
    return {
      lat: local.lat,
      lng: local.lng,
      label: placeLabelFromGeocodePoint(local, zip),
    };
  }

  const cached = readCachedZipPoint(zip);
  if (cached) {
    return {
      lat: cached.lat,
      lng: cached.lng,
      label: placeLabelFromGeocodePoint(cached, zip),
    };
  }

  return undefined;
}

export async function resolveSearchOriginWithGeocode(
  params: NearbyStoreSearchParams,
  geocodeZip: (zip: string) => Promise<
    | { ok: true; point: GeocodedPoint }
    | { ok: false; reason: 'invalid_zip' | 'not_found' | 'rate_limited' | 'network' }
  >,
  zipGeocodeMessage: (reason: string) => string,
): Promise<ResolvedGeo> {
  const fast = resolveSearchOriginFast(params);
  if (fast) return fast;

  if (params.zip) {
    const result = await geocodeZip(params.zip);
    if (!result.ok) throw new Error(zipGeocodeMessage(result.reason));
    const zip = params.zip.slice(0, 5);
    return {
      lat: result.point.lat,
      lng: result.point.lng,
      label: placeLabelFromGeocodePoint(result.point, zip),
    };
  }

  throw new Error('Set your location or enter a ZIP code to find stores.');
}
