import { STORES_TAB_DISPLAY_LIMIT, STORES_TAB_LOCAL_MARKETS_LIMIT } from '../../config/storesTab';
import { isSupabaseConfigured } from '../../config/appConfig';
import { mergeKrogerLocations, type KrogerLocationRow } from './krogerMerge';
import { roundCoordsForPrivacy } from './geoPrivacy';
import { applyOriginDistancesAndSort } from './storeDistance';
import { isNearbyListStoreNameAllowed } from './catalogStoreFilter';
import { splitStoresByRecognition } from './storeRecognition';
import type { StoreRecord } from './types';

export type StoresNearbyPipelineOrigin = { lat: number; lng: number };

export function normalizePipelineOrigin(origin: StoresNearbyPipelineOrigin): StoresNearbyPipelineOrigin {
  return roundCoordsForPrivacy(origin.lat, origin.lng);
}

/** Drop blocklisted names; Supabase RPC rows are not re-filtered with OSM shop tags. */
export function filterCatalogStoresForNearbyList(stores: StoreRecord[]): StoreRecord[] {
  return stores.filter((store) => isNearbyListStoreNameAllowed(store.name, store.chain));
}

export function mergeCatalogWithKrogerLocations(
  catalog: StoreRecord[],
  krogerStores: KrogerLocationRow[],
): StoreRecord[] {
  if (krogerStores.length === 0) return catalog;
  return mergeKrogerLocations(catalog, krogerStores);
}

/**
 * Stores tab order: recognised chains and brands first (closest first, up to `displayLimit`),
 * then unbranded local markets (closest first, up to `localLimit`). No open-now boost or favorites.
 * Call after RPC + Kroger merge + fallback merge.
 */
export function sortAndLimitStoresForStoresTab(
  stores: StoreRecord[],
  origin: StoresNearbyPipelineOrigin,
  displayLimit = STORES_TAB_DISPLAY_LIMIT,
  localLimit = STORES_TAB_LOCAL_MARKETS_LIMIT,
): StoreRecord[] {
  const sorted = applyOriginDistancesAndSort(stores, origin);
  const { recognized, local } = splitStoresByRecognition(sorted);
  if (displayLimit <= 0) return [...recognized, ...local];
  return [...recognized.slice(0, displayLimit), ...local.slice(0, Math.max(0, localLimit))];
}

export function finalizeStoresTabNearbyList(
  catalog: StoreRecord[],
  origin: StoresNearbyPipelineOrigin,
  options?: {
    krogerStores?: KrogerLocationRow[];
    displayLimit?: number;
  },
): StoreRecord[] {
  const filtered = filterCatalogStoresForNearbyList(catalog);
  const merged = mergeCatalogWithKrogerLocations(filtered, options?.krogerStores ?? []);
  return sortAndLimitStoresForStoresTab(merged, origin, options?.displayLimit);
}

/** Instant preview should not mask Supabase results with bundled regional JSON. */
export function shouldUseRegionalFallbackForPreview(): boolean {
  return !isSupabaseConfigured();
}
