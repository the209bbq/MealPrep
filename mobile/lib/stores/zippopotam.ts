import { SMART_SHOP_STORES } from '../../config/smartShop';
import type { GeocodedPoint } from './nominatim';
import { readPersistentCache, writePersistentCache } from './osmPersistentCache';

type ZippopotamResponse = {
  places?: { latitude?: string; longitude?: string; 'place name'?: string; 'state abbreviation'?: string }[];
};

export async function geocodeUsZipViaZippopotam(zip: string): Promise<GeocodedPoint | null> {
  const normalized = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(normalized)) return null;

  const cacheKey = `zippopotam:zip:${normalized}`;
  const cached = readPersistentCache<GeocodedPoint>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`https://api.zippopotam.us/us/${normalized}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const json = (await response.json()) as ZippopotamResponse;
    const place = json.places?.[0];
    if (!place?.latitude || !place.longitude) return null;
    const lat = Number(place.latitude);
    const lng = Number(place.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const city = place['place name']?.trim() ?? '';
    const state = place['state abbreviation']?.trim() ?? '';
    const displayName =
      city && state ? `${city}, ${state}, United States` : `${normalized}, United States`;

    const point: GeocodedPoint = { lat, lng, displayName };
    writePersistentCache(cacheKey, point, SMART_SHOP_STORES.zipGeocodePersistentTtlMs);
    return point;
  } catch {
    return null;
  }
}
