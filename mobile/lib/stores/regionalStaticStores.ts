import type { StoreRecord } from './types';

type RegionalStaticStoreJson = {
  attribution: string;
  generatedAt: string;
  stores: StoreRecord[];
};

let cachedRegionalStores: StoreRecord[] | null = null;

/** Bundled grocery stores near Oakdale / 209 (OSM-sourced snapshot). */
export function loadRegionalStaticGroceryStores(): StoreRecord[] {
  if (cachedRegionalStores) return cachedRegionalStores;
  try {
    const payload = require('../../data/oakdale-region-stores.json') as RegionalStaticStoreJson;
    cachedRegionalStores = payload.stores ?? [];
    return cachedRegionalStores;
  } catch {
    cachedRegionalStores = [];
    return cachedRegionalStores;
  }
}

export function regionalStaticStoreAttribution(): string | null {
  try {
    const payload = require('../../data/oakdale-region-stores.json') as RegionalStaticStoreJson;
    return payload.attribution ?? null;
  } catch {
    return null;
  }
}
