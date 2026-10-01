import { readCache } from './cache';
import { localZipPlaceLabel } from './localZipTable';
import { geocodeUsZip, type GeocodedPoint } from './nominatim';
import { readPersistentCache } from './osmPersistentCache';
import { placeLabelFromGeocodePoint } from './zipPlaceParse';

export { parseCityStateFromNominatimDisplay } from './zipPlaceParse';

export function readCachedZipPlaceLabel(zip: string): string | undefined {
  const normalized = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(normalized)) return undefined;
  const local = localZipPlaceLabel(normalized);
  if (local) return local;
  const cacheKey = `nominatim:zip:${normalized}`;
  const cached = readCache<GeocodedPoint>(cacheKey) ?? readPersistentCache<GeocodedPoint>(cacheKey);
  if (!cached) return undefined;
  return placeLabelFromGeocodePoint(cached, normalized);
}

export async function resolveZipPlaceLabel(zip: string): Promise<string> {
  const normalized = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(normalized)) return zip.trim();
  const local = localZipPlaceLabel(normalized);
  if (local) return local;

  const cachedLabel = readCachedZipPlaceLabel(normalized);
  if (cachedLabel && cachedLabel !== normalized) return cachedLabel;
  const result = await geocodeUsZip(normalized);
  if (!result.ok) return normalized;
  return placeLabelFromGeocodePoint(result.point, normalized);
}
