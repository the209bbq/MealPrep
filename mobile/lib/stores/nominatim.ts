import { SMART_SHOP_STORES } from '../../config/smartShop';
import { readCache, writeCache } from './cache';
import { lookupLocalZipGeocode } from './localZipTable';
import { readPersistentCache, writePersistentCache } from './osmPersistentCache';
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

  const cacheKey = `zcta:zip:${normalized}`;
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

  return { ok: false, reason: 'not_found' };
}

/** @deprecated Prefer geocodeUsZip — kept for callers expecting null. */
export async function geocodeUsZipOrNull(zip: string): Promise<GeocodedPoint | null> {
  const result = await geocodeUsZip(zip);
  return result.ok ? result.point : null;
}
