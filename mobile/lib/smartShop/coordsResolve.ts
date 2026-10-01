import type { SavedCoords } from './storage';

export function coordsForStoreSearch(input: {
  savedCoords: SavedCoords | null;
  profileZip?: string | null;
  savedZip?: string;
  profileLat?: number | null;
  profileLng?: number | null;
}): { lat: number; lng: number } | undefined {
  if (input.savedCoords) {
    return { lat: input.savedCoords.lat, lng: input.savedCoords.lng };
  }
  const zip = (input.profileZip ?? input.savedZip ?? '').trim();
  if (zip) return undefined;
  if (input.profileLat != null && input.profileLng != null) {
    return { lat: input.profileLat, lng: input.profileLng };
  }
  return undefined;
}
