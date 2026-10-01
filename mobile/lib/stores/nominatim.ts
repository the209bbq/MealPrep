import { SMART_SHOP_STORES } from '../../config/smartShop';
import { readCache, writeCache } from './cache';
import { lookupLocalZipGeocode } from './localZipTable';
import { isRateLimitedStatus, nominatimSearchParams, osmRequestHeaders } from './osmHttp';
import { readPersistentCache, writePersistentCache } from './osmPersistentCache';
import { geocodeUsZipViaZippopotam } from './zippopotam';

export interface GeocodedPoint {
  lat: number;
  lng: number;
  displayName?: string;
}

export type GeocodeResult =
  | { ok: true; point: GeocodedPoint }
  | { ok: false; reason: 'invalid_zip' | 'not_found' | 'rate_limited' | 'network' };

export async function geocodeUsZip(zip: string): Promise<GeocodeResult> {
  const normalized = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(normalized)) return { ok: false, reason: 'invalid_zip' };

  const cacheKey = `nominatim:zip:${normalized}`;
  const cached = readCache<GeocodedPoint>(cacheKey);
  if (cached) return { ok: true, point: cached };

  const persistent = readPersistentCache<GeocodedPoint>(cacheKey);
  if (persistent) {
    writeCache(cacheKey, persistent, SMART_SHOP_STORES.cacheTtlMs);
    return { ok: true, point: persistent };
  }

  const local = lookupLocalZipGeocode(normalized);
  if (local) {
    writeCache(cacheKey, local, SMART_SHOP_STORES.cacheTtlMs);
    writePersistentCache(cacheKey, local, SMART_SHOP_STORES.zipGeocodePersistentTtlMs);
    return { ok: true, point: local };
  }

  const zippo = await geocodeUsZipViaZippopotam(normalized);
  if (zippo) {
    writeCache(cacheKey, zippo, SMART_SHOP_STORES.cacheTtlMs);
    writePersistentCache(cacheKey, zippo, SMART_SHOP_STORES.zipGeocodePersistentTtlMs);
    return { ok: true, point: zippo };
  }

  const url = `${SMART_SHOP_STORES.nominatimBaseUrl}/search?${nominatimSearchParams({
    postalcode: normalized,
    country: 'us',
    format: 'json',
    limit: '1',
  }).toString()}`;

  try {
    const response = await fetch(url, { headers: osmRequestHeaders() });
    if (isRateLimitedStatus(response.status)) return { ok: false, reason: 'rate_limited' };
    if (!response.ok) return { ok: false, reason: 'network' };

    const rows = (await response.json()) as { lat?: string; lon?: string; display_name?: string }[];
    const hit = rows[0];
    if (!hit?.lat || !hit.lon) return { ok: false, reason: 'not_found' };

    const point: GeocodedPoint = {
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      displayName: hit.display_name,
    };
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return { ok: false, reason: 'not_found' };

    writeCache(cacheKey, point, SMART_SHOP_STORES.cacheTtlMs);
    writePersistentCache(cacheKey, point, SMART_SHOP_STORES.zipGeocodePersistentTtlMs);
    return { ok: true, point };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

/** @deprecated Prefer geocodeUsZip — kept for callers expecting null. */
export async function geocodeUsZipOrNull(zip: string): Promise<GeocodedPoint | null> {
  const result = await geocodeUsZip(zip);
  return result.ok ? result.point : null;
}
