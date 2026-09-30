import { SMART_SHOP_STORES } from '../../config/smartShop';
import { readCache, writeCache } from './cache';

export interface GeocodedPoint {
  lat: number;
  lng: number;
  displayName?: string;
}

export async function geocodeUsZip(zip: string): Promise<GeocodedPoint | null> {
  const normalized = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(normalized)) return null;

  const cacheKey = `nominatim:zip:${normalized}`;
  const cached = readCache<GeocodedPoint>(cacheKey);
  if (cached) return cached;

  const url = `${SMART_SHOP_STORES.nominatimBaseUrl}/search?${new URLSearchParams({
    postalcode: normalized,
    country: 'us',
    format: 'json',
    limit: '1',
  }).toString()}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': SMART_SHOP_STORES.httpUserAgent,
      Accept: 'application/json',
    },
  });
  if (!response.ok) return null;

  const rows = (await response.json()) as { lat?: string; lon?: string; display_name?: string }[];
  const hit = rows[0];
  if (!hit?.lat || !hit.lon) return null;

  const point: GeocodedPoint = {
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    displayName: hit.display_name,
  };
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;

  writeCache(cacheKey, point, SMART_SHOP_STORES.cacheTtlMs);
  return point;
}
