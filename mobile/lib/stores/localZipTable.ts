import type { GeocodedPoint } from './nominatim';

/** Primary ZIP → city labels for Central Valley / local Smart Shop QA (no network). */
const LOCAL_ZIP_PLACES: Record<string, { city: string; state: string; lat: number; lng: number }> = {
  '95320': { city: 'Escalon', state: 'CA', lat: 37.7974, lng: -120.9966 },
  '95350': { city: 'Modesto', state: 'CA', lat: 37.6391, lng: -120.9969 },
  '95351': { city: 'Modesto', state: 'CA', lat: 37.6258, lng: -121.0022 },
  '95352': { city: 'Modesto', state: 'CA', lat: 37.6612, lng: -120.9445 },
  '95353': { city: 'Modesto', state: 'CA', lat: 37.6391, lng: -120.9969 },
  '95354': { city: 'Modesto', state: 'CA', lat: 37.6391, lng: -120.9969 },
  '95355': { city: 'Modesto', state: 'CA', lat: 37.6819, lng: -121.0528 },
  '95356': { city: 'Modesto', state: 'CA', lat: 37.703, lng: -121.0555 },
  '95357': { city: 'Modesto', state: 'CA', lat: 37.6105, lng: -120.9185 },
  '95358': { city: 'Modesto', state: 'CA', lat: 37.6105, lng: -120.9185 },
  '95361': { city: 'Oakdale', state: 'CA', lat: 37.7666, lng: -120.8472 },
  '95367': { city: 'Riverbank', state: 'CA', lat: 37.7358, lng: -120.9266 },
};

export function lookupLocalZipGeocode(zip: string): GeocodedPoint | null {
  const normalized = zip.trim().slice(0, 5);
  const row = LOCAL_ZIP_PLACES[normalized];
  if (!row) return null;
  const displayName = `${row.city}, ${row.state}, United States`;
  return { lat: row.lat, lng: row.lng, displayName };
}

export function localZipPlaceLabel(zip: string): string | null {
  const normalized = zip.trim().slice(0, 5);
  const row = LOCAL_ZIP_PLACES[normalized];
  if (!row) return null;
  return `${row.city}, ${row.state}`;
}
