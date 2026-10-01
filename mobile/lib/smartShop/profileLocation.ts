import { isDemoMode, isSupabaseConfigured } from '../../config/appConfig';
import { getSupabase } from '../supabase';
import type { UserProfile } from '../../types/mealprep';
import {
  readSavedCoords,
  readSavedStoreIds,
  readSavedZip,
  type SavedCoords,
  writeSavedCoords,
  writeSavedStoreIds,
  writeSavedStoreSummaries,
  writeSavedZip,
} from './storage';
import type { StoreLocation } from '../deals/types';
import { coordsForStoreSearch } from './coordsResolve';

export interface HomeLocationPatch {
  zip?: string;
  lat?: number;
  lng?: number;
}

export function hydrateLocationFromProfile(profile: UserProfile): void {
  if (profile.homeZip) writeSavedZip(profile.homeZip);
  if (profile.homeLat != null && profile.homeLng != null) {
    writeSavedCoords({
      lat: profile.homeLat,
      lng: profile.homeLng,
      updatedAt: profile.homeLocationUpdatedAt ?? new Date().toISOString(),
    });
  }
}

export async function persistHomeLocation(patch: HomeLocationPatch): Promise<void> {
  if (patch.zip) writeSavedZip(patch.zip);
  if (patch.lat != null && patch.lng != null) {
    writeSavedCoords({
      lat: patch.lat,
      lng: patch.lng,
      updatedAt: new Date().toISOString(),
    });
  } else if (patch.zip) {
    writeSavedCoords(null);
  }

  if (isDemoMode() || !isSupabaseConfigured()) return;
  const client = getSupabase();
  if (!client) return;
  const { data: userData } = await client.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  const row: Record<string, string | number | null> = {
    home_location_updated_at: new Date().toISOString(),
  };
  if (patch.zip) row.home_zip = patch.zip.slice(0, 10);
  if (patch.lat != null) row.home_lat = patch.lat;
  if (patch.lng != null) row.home_lng = patch.lng;
  if (patch.zip && patch.lat == null && patch.lng == null) {
    row.home_lat = null;
    row.home_lng = null;
  }

  await client.from('profiles').update(row).eq('id', userId);
}

function storeKey(store: StoreLocation): string {
  return store.krogerLocationId ?? store.id;
}

export async function loadFavoriteStoreIds(): Promise<string[]> {
  if (isDemoMode() || !isSupabaseConfigured()) return readSavedStoreIds();
  const client = getSupabase();
  if (!client) return readSavedStoreIds();

  const { data: userData } = await client.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return readSavedStoreIds();

  const { data, error } = await client
    .from('user_favorite_stores')
    .select('store_key')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });

  if (error || !data?.length) return readSavedStoreIds();
  const ids = data.map((r) => String((r as { store_key: string }).store_key));
  writeSavedStoreIds(ids);
  return ids;
}

export async function persistFavoriteStores(stores: StoreLocation[]): Promise<void> {
  const keys = stores.map(storeKey);
  writeSavedStoreIds(keys);
  writeSavedStoreSummaries(
    stores.map((store) => ({
      id: storeKey(store),
      name: store.name,
      chain: store.chain || store.name,
    })),
  );

  if (isDemoMode() || !isSupabaseConfigured()) return;
  const client = getSupabase();
  if (!client) return;
  const { data: userData } = await client.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  const desiredKeys = new Set(keys);
  const { data: existingRows, error: readError } = await client
    .from('user_favorite_stores')
    .select('store_key')
    .eq('user_id', userId);

  if (readError) return;

  const existingKeys = new Set((existingRows ?? []).map((r) => String((r as { store_key: string }).store_key)));
  const toRemove = [...existingKeys].filter((k) => !desiredKeys.has(k));

  if (stores.length > 0) {
    const rows = stores.map((store, index) => ({
      user_id: userId,
      store_key: storeKey(store),
      name: store.name,
      chain: store.chain,
      address_line: store.addressLine,
      city: store.city,
      state: store.state,
      zip: store.zip,
      lat: store.lat ?? null,
      lng: store.lng ?? null,
      kroger_location_id: store.krogerLocationId ?? null,
      source: store.source ?? 'osm',
      sort_order: index,
    }));

    const { error: upsertError } = await client.from('user_favorite_stores').upsert(rows, {
      onConflict: 'user_id,store_key',
    });
    if (upsertError) return;
  }

  if (toRemove.length > 0) {
    const { error: deleteError } = await client
      .from('user_favorite_stores')
      .delete()
      .eq('user_id', userId)
      .in('store_key', toRemove);
    if (deleteError) return;
  }
}

export function readInitialZip(profile: UserProfile): string {
  return profile.homeZip ?? readSavedZip() ?? '';
}

export { coordsForStoreSearch } from './coordsResolve';

export function readInitialCoords(profile: UserProfile): { lat: number; lng: number } | undefined {
  return coordsForStoreSearch({
    savedCoords: readSavedCoords(),
    profileZip: profile.homeZip,
    savedZip: readSavedZip(),
    profileLat: profile.homeLat,
    profileLng: profile.homeLng,
  });
}
