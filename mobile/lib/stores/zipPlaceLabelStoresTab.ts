import { geocodeUsZipForStoresTab } from './storesTabGeocode';
import { localZipPlaceLabel } from './localZipTable';
import { readCachedZipPlaceLabel } from './zipPlaceLabel';
import { placeLabelFromGeocodePoint } from './zipPlaceParse';

/** Place label for a ZIP on the Stores tab (may use ZCTA-backed geocode). */
export async function resolveZipPlaceLabelForStoresTab(zip: string): Promise<string> {
  const normalized = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(normalized)) return zip.trim();
  const local = localZipPlaceLabel(normalized);
  if (local) return local;

  const cachedLabel = readCachedZipPlaceLabel(normalized);
  if (cachedLabel && cachedLabel !== normalized) return cachedLabel;

  const result = await geocodeUsZipForStoresTab(normalized);
  if (!result.ok) return normalized;
  return placeLabelFromGeocodePoint(result.point, normalized);
}
