import { readSavedStoreSummaries } from '../smartShop/storage';
import { mapsDirectionsUrl } from '../../config/smartShop';
import type { StoreRecord } from './types';

/** Last-known favorite stores when Overpass is unreachable (minimal rows for comparison UI). */
export function loadSavedStoresFallback(zip?: string): StoreRecord[] {
  const summaries = readSavedStoreSummaries();
  if (summaries.length === 0) return [];

  const zipSlice = zip?.trim().slice(0, 5) ?? '';
  return summaries.map((row) => {
    const store: StoreRecord = {
      id: row.id,
      name: row.name,
      chain: row.chain || row.name,
      addressLine: '',
      city: '',
      state: '',
      zip: zipSlice,
      source: 'manual',
      pricingSource: 'none',
    };
    return { ...store, url: mapsDirectionsUrl(store) };
  });
}
