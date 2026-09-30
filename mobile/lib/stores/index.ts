import { mapsDirectionsUrl, SMART_SHOP_STORES } from '../../config/smartShop';
import { geocodeUsZip } from './nominatim';
import { fetchOverpassStores } from './overpass';
import type { NearbyStoreSearchParams, ResolvedGeo, StoreRecord } from './types';

export type { NearbyStoreSearchParams, ResolvedGeo, StoreRecord } from './types';
export { geocodeUsZip } from './nominatim';
export { mapsDirectionsUrl };

export async function resolveSearchOrigin(params: NearbyStoreSearchParams): Promise<ResolvedGeo> {
  if (params.lat != null && params.lng != null && Number.isFinite(params.lat) && Number.isFinite(params.lng)) {
    return { lat: params.lat, lng: params.lng, label: 'your location' };
  }
  if (params.zip) {
    const point = await geocodeUsZip(params.zip);
    if (!point) throw new Error('Could not find that ZIP code. Check and try again.');
    return { lat: point.lat, lng: point.lng, label: `ZIP ${params.zip.slice(0, 5)}` };
  }
  throw new Error('Set your location or enter a ZIP code to find stores.');
}

export async function searchNearbyGroceryStores(params: NearbyStoreSearchParams): Promise<{
  origin: ResolvedGeo;
  stores: StoreRecord[];
}> {
  const origin = await resolveSearchOrigin(params);
  const stores = await fetchOverpassStores(origin, params);
  return {
    origin,
    stores: stores.map((s) => ({
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
