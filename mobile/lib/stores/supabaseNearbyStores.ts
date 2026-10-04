import { isSupabaseConfigured } from '../../config/appConfig';
import { getSupabase } from '../supabase';
import { resolveGroceryChainFromHaystack } from './groceryFilter';
import { resolveOpenNowFromOsmHours } from './openingHours';
import { roundCoordsForPrivacy } from './geoPrivacy';
import {
  readCachedNearbyStores,
  readCachedNearbyStoresStale,
  writeCachedNearbyStores,
} from './storeSearchCache';
import type { StoreRecord } from './types';

type NearbyStoresRow = {
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

function rowToStoreRecord(row: NearbyStoresRow): StoreRecord {
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
  };
}

export type FetchSupabaseNearbyResult =
  | { ok: true; stores: StoreRecord[]; fromCache?: boolean }
  | { ok: false; reason: 'unconfigured' | 'error' | 'empty' };

export async function fetchNearbyStoresFromSupabase(
  origin: { lat: number; lng: number },
  options: { radiusM: number; limit?: number; cacheOnly?: boolean },
): Promise<FetchSupabaseNearbyResult> {
  const rounded = roundCoordsForPrivacy(origin.lat, origin.lng);
  const radiusM = options.radiusM;
  const limit = options.limit ?? 40;

  const cached = readCachedNearbyStores(rounded, radiusM);
  if (cached?.length) {
    return { ok: true, stores: cached, fromCache: true };
  }

  if (options.cacheOnly) {
    const stale = readCachedNearbyStoresStale(rounded, radiusM);
    if (stale?.length) return { ok: true, stores: stale, fromCache: true };
    return { ok: false, reason: 'error' };
  }

  if (!isSupabaseConfigured()) return { ok: false, reason: 'unconfigured' };
  const client = getSupabase();
  if (!client) return { ok: false, reason: 'unconfigured' };

  const { data, error } = await client.rpc('nearby_stores', {
    p_lat: rounded.lat,
    p_lng: rounded.lng,
    p_radius_m: radiusM,
    p_limit: limit,
  });

  if (error) {
    return { ok: false, reason: 'error' };
  }

  const rows = (data ?? []) as NearbyStoresRow[];
  if (rows.length === 0) {
    return { ok: false, reason: 'empty' };
  }

  const stores = rows.map(rowToStoreRecord);
  writeCachedNearbyStores(rounded, radiusM, stores);
  return { ok: true, stores };
}
