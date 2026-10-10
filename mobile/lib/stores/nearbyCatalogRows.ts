import { STORE_SEARCH } from '../../config/storeSearch';
import { isNearbyListStoreNameAllowed } from './catalogStoreFilter';
import { resolveGroceryChainFromHaystack } from './groceryFilter';
import { resolveOpenNowFromOsmHours } from './openingHours';
import { splitStoresByRecognition } from './storeRecognition';
import type { StoreRecord } from './types';

/** Pure mapping and trimming for `nearby_stores` rows (no network, safe to import in checks). */

export type NearbyStoresRow = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  address_line: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  opening_hours: string | null;
  sources: string[] | null;
  distance_m: number;
};

export function rowToStoreRecord(row: NearbyStoresRow): StoreRecord {
  const haystack = `${row.name} ${row.brand ?? ''}`.toLowerCase();
  const known = resolveGroceryChainFromHaystack(haystack);
  const chain = known?.displayName ?? (row.brand?.trim() || row.name);
  const openingHours = row.opening_hours?.trim() || undefined;
  const distanceMiles = Math.round((row.distance_m / 1609.344) * 100) / 100;
  return {
    id: row.id,
    name: row.name,
    chain,
    addressLine: row.address_line ?? '',
    city: row.city ?? '',
    state: row.state ?? '',
    zip: row.zip ?? '',
    lat: row.lat,
    lng: row.lng,
    distanceMiles,
    source: 'osm',
    pricingSource: 'none',
    phone: row.phone?.trim() || undefined,
    website: row.website?.trim() || undefined,
    openingHours,
    openNow: resolveOpenNowFromOsmHours(openingHours),
    knownBrand: Boolean(known) || Boolean(row.brand?.trim()),
  };
}

/**
 * Rows arrive nearest first. Drop blocklisted names, then keep the nearest recognised stores
 * and the nearest others separately, so a cluster of unbranded listings near the origin
 * cannot push every supermarket out of the result.
 */
export function selectNearbyCatalogStores(
  stores: StoreRecord[],
  keepPerGroup: number = STORE_SEARCH.nearbyKeepPerGroup,
): StoreRecord[] {
  const allowed = stores.filter((store) => isNearbyListStoreNameAllowed(store.name, store.chain));
  const { recognized, local } = splitStoresByRecognition(allowed);
  const kept = new Set([...recognized.slice(0, keepPerGroup), ...local.slice(0, keepPerGroup)]);
  return allowed.filter((store) => kept.has(store));
}
