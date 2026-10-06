import { SMART_SHOP_STORES } from '../../config/smartShop';
import { readCache, writeCache } from './cache';
import { geocodeUsZip, type GeocodeResult } from './nominatim';
import { readPersistentCache, writePersistentCache } from './osmPersistentCache';

/**
 * ZIP geocode for the Stores tab only — may load the bundled ZCTA table after local/cache lookup.
 * Do not import this module outside the Stores tab flow.
 */
export async function geocodeUsZipForStoresTab(zip: string): Promise<GeocodeResult> {
  const normalized = zip.trim().slice(0, 5);
  const base = await geocodeUsZip(normalized);
  if (base.ok) return base;
  if (base.reason !== 'not_found') return base;

  const { lookupZctaCentroid } = await import('./zctaCentroids');
  const zcta = await lookupZctaCentroid(normalized);
  if (!zcta) return { ok: false, reason: 'not_found' };

  const cacheKey = `zcta:zip:${normalized}`;
  writeCache(cacheKey, zcta, SMART_SHOP_STORES.cacheTtlMs);
  writePersistentCache(cacheKey, zcta, SMART_SHOP_STORES.zipGeocodePersistentTtlMs);
  return { ok: true, point: zcta };
}
