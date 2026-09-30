import { mapsDirectionsUrl, SMART_SHOP_STORES } from '../../config/smartShop';
import { geocodeUsZip } from './nominatim';
import { fetchOverpassStores } from './overpass';
import type { NearbyStoreSearchParams, ResolvedGeo, StoreRecord } from './types';

export type { NearbyStoreSearchParams, ResolvedGeo, StoreRecord } from './types';
export { geocodeUsZip, geocodeUsZipOrNull } from './nominatim';
export { mapsDirectionsUrl };

function zipGeocodeMessage(reason: string): string {
  switch (reason) {
    case 'rate_limited':
      return 'ZIP lookup is rate-limited. Try “Use my location” or wait a minute.';
    case 'not_found':
      return 'Could not find that ZIP code. Check and try again.';
    case 'invalid_zip':
      return 'Enter a valid 5-digit US ZIP code.';
    default:
      return 'ZIP lookup failed. Try “Use my location”.';
  }
}

function overpassWarning(reason: string): string | undefined {
  switch (reason) {
    case 'rate_limited':
      return 'OpenStreetMap is busy (rate limit). Showing Kroger locations only if available.';
    case 'network':
      return 'Could not reach OpenStreetMap. Showing Kroger locations only if available.';
    case 'empty':
      return 'No OSM grocery pins nearby. Kroger locations may still appear below.';
    default:
      return undefined;
  }
}

export async function resolveSearchOrigin(params: NearbyStoreSearchParams): Promise<ResolvedGeo> {
  if (params.lat != null && params.lng != null && Number.isFinite(params.lat) && Number.isFinite(params.lng)) {
    return { lat: params.lat, lng: params.lng, label: 'your location' };
  }
  if (params.zip) {
    const result = await geocodeUsZip(params.zip);
    if (!result.ok) throw new Error(zipGeocodeMessage(result.reason));
    return { lat: result.point.lat, lng: result.point.lng, label: `ZIP ${params.zip.slice(0, 5)}` };
  }
  throw new Error('Set your location or enter a ZIP code to find stores.');
}

export async function searchNearbyGroceryStores(params: NearbyStoreSearchParams): Promise<{
  origin: ResolvedGeo;
  stores: StoreRecord[];
  osmWarning?: string;
}> {
  const origin = await resolveSearchOrigin(params);
  const overpass = await fetchOverpassStores(origin, params);
  const osmStores = overpass.ok ? overpass.stores : [];
  const osmWarning = overpass.ok ? undefined : overpassWarning(overpass.reason);

  return {
    origin,
    osmWarning,
    stores: osmStores.map((s) => ({
      ...s,
      url: mapsDirectionsUrl(s),
    })),
  };
}

export function manualStoreFromInput(input: {
  name: string;
  addressLine: string;
  city: string;
  state: string;
  zip: string;
}): StoreRecord {
  const key = `${input.name}-${input.zip}`.toLowerCase().replace(/\s+/g, '-');
  const store: StoreRecord = {
    id: `manual-${key}`,
    name: input.name.trim(),
    chain: input.name.trim(),
    addressLine: input.addressLine.trim(),
    city: input.city.trim(),
    state: input.state.trim(),
    zip: input.zip.trim().slice(0, 10),
    source: 'manual',
    pricingSource: 'none',
  };
  return { ...store, url: mapsDirectionsUrl(store) };
}

export function limitFavoriteStores(stores: StoreRecord[]): StoreRecord[] {
  return stores.slice(0, SMART_SHOP_STORES.maxSavedStores);
}
