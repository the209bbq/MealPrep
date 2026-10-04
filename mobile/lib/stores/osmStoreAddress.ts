import { haversineMiles } from '../../config/smartShop';

export const REGION_TOWN_CENTROIDS: ReadonlyArray<{ name: string; lat: number; lng: number }> = [
  { name: 'Oakdale', lat: 37.7665, lng: -120.8471 },
  { name: 'Riverbank', lat: 37.7358, lng: -120.9453 },
  { name: 'Modesto', lat: 37.6391, lng: -120.9969 },
  { name: 'Escalon', lat: 37.7974, lng: -120.9962 },
  { name: 'Salida', lat: 37.7108, lng: -121.0895 },
  { name: 'Ripon', lat: 37.7391, lng: -121.1312 },
  { name: 'Turlock', lat: 37.4947, lng: -120.8466 },
  { name: 'Manteca', lat: 37.7974, lng: -121.2161 },
  { name: 'Waterford', lat: 37.641, lng: -120.76 },
  { name: 'Hughson', lat: 37.5969, lng: -120.866 },
];

export function nearestRegionTown(lat: number, lng: number): string {
  let best = REGION_TOWN_CENTROIDS[0];
  let bestDist = Infinity;
  for (const town of REGION_TOWN_CENTROIDS) {
    const dist = haversineMiles({ lat, lng }, { lat: town.lat, lng: town.lng });
    if (dist < bestDist) {
      bestDist = dist;
      best = town;
    }
  }
  return best.name;
}

export function parseOsmAddressTags(tags: Record<string, string>): {
  addressLine: string;
  city: string;
  state: string;
  zip: string;
} {
  const housenumber = tags['addr:housenumber'] ?? '';
  const street = tags['addr:street'] ?? tags['addr:place'] ?? '';
  const addressLine = [housenumber, street].filter(Boolean).join(' ').trim() || tags['addr:full']?.trim() || '';
  const city = (tags['addr:city'] ?? tags['addr:town'] ?? tags['addr:village'] ?? '').trim();
  const state = (tags['addr:state'] ?? 'CA').trim();
  const zip = (tags['addr:postcode'] ?? '').trim().slice(0, 10);
  return { addressLine, city, state, zip };
}

export function enrichStoreAddressFields(
  fields: { addressLine: string; city: string; state: string; zip: string },
  lat: number,
  lng: number,
): { addressLine: string; city: string; state: string; zip: string } {
  const city = fields.city || nearestRegionTown(lat, lng);
  const state = fields.state || 'CA';
  return {
    addressLine: fields.addressLine,
    city,
    state,
    zip: fields.zip,
  };
}
