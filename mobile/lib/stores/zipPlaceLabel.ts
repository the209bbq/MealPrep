import { readCache } from './cache';
import { geocodeUsZip, type GeocodedPoint } from './nominatim';
import { placeLabelFromGeocodePoint } from './zipPlaceParse';

export { parseCityStateFromNominatimDisplay } from './zipPlaceParse';

export function readCachedZipPlaceLabel(zip: string): string | undefined {
  const normalized = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(normalized)) return undefined;
  const cached = readCache<GeocodedPoint>(`nominatim:zip:${normalized}`);
  if (!cached) return undefined;
  return placeLabelFromGeocodePoint(cached, normalized);
}

export async function resolveZipPlaceLabel(zip: string): Promise<string> {
  const normalized = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(normalized)) return zip.trim();
  const cachedLabel = readCachedZipPlaceLabel(normalized);
  if (cachedLabel) return cachedLabel;
  const result = await geocodeUsZip(normalized);
  if (!result.ok) return normalized;
  return placeLabelFromGeocodePoint(result.point, normalized);
}
