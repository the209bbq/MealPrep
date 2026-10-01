import type { StoreLocation } from '../deals/types';
import { normalizeIngredientName } from '../recipeMatch/normalize';
import { readJson, removeStorageKey, writeJson } from '../storage';

const STORAGE_PREFIX = 'mealprep.smartShop.addPriceMemory';

export interface SavedAddPriceStore {
  id: string;
  name: string;
  chain: string;
  addressLine: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
  krogerLocationId?: string;
  source?: StoreLocation['source'];
  pricingSource?: StoreLocation['pricingSource'];
}

export interface AddPriceMemory {
  lastStore?: SavedAddPriceStore;
  /** Normalized item name → last size/unit string. */
  itemSizeUnits: Record<string, string>;
}

function storageKey(ownerId: string): string {
  return `${STORAGE_PREFIX}.${ownerId || 'demo-user'}`;
}

const EMPTY: AddPriceMemory = { itemSizeUnits: {} };

export function readAddPriceMemory(ownerId: string): AddPriceMemory {
  const raw = readJson<AddPriceMemory | null>(storageKey(ownerId), null);
  if (!raw) return { ...EMPTY, itemSizeUnits: {} };
  return {
    lastStore: raw.lastStore,
    itemSizeUnits: raw.itemSizeUnits ?? {},
  };
}

function writeAddPriceMemory(ownerId: string, memory: AddPriceMemory): void {
  writeJson(storageKey(ownerId), memory);
}

export function clearAddPriceMemory(ownerId: string): void {
  removeStorageKey(storageKey(ownerId));
}

export function itemNameKey(itemName: string): string {
  return normalizeIngredientName(itemName.trim());
}

export function storeToSaved(store: StoreLocation): SavedAddPriceStore {
  return {
    id: store.id,
    name: store.name,
    chain: store.chain,
    addressLine: store.addressLine,
    city: store.city,
    state: store.state,
    zip: store.zip,
    lat: store.lat,
    lng: store.lng,
    krogerLocationId: store.krogerLocationId,
    source: store.source,
    pricingSource: store.pricingSource,
  };
}

export function savedStoreToLocation(saved: SavedAddPriceStore): StoreLocation {
  return {
    id: saved.id,
    name: saved.name,
    chain: saved.chain,
    addressLine: saved.addressLine,
    city: saved.city,
    state: saved.state,
    zip: saved.zip,
    lat: saved.lat,
    lng: saved.lng,
    krogerLocationId: saved.krogerLocationId,
    source: saved.source,
    pricingSource: saved.pricingSource,
  };
}

export function resolveStoreFromMemory(
  memory: AddPriceMemory,
  nearbyStores: StoreLocation[],
): StoreLocation | null {
  const saved = memory.lastStore;
  if (!saved) return null;
  const match = nearbyStores.find(
    (s) => s.id === saved.id || (saved.krogerLocationId && s.krogerLocationId === saved.krogerLocationId),
  );
  if (match) return match;
  return savedStoreToLocation(saved);
}

export function rememberLastAddPriceStore(ownerId: string, store: StoreLocation): void {
  const memory = readAddPriceMemory(ownerId);
  writeAddPriceMemory(ownerId, { ...memory, lastStore: storeToSaved(store) });
}

export function rememberItemSizeUnit(ownerId: string, itemName: string, sizeUnit: string): void {
  const trimmed = sizeUnit.trim();
  if (!trimmed) return;
  const key = itemNameKey(itemName);
  const memory = readAddPriceMemory(ownerId);
  writeAddPriceMemory(ownerId, {
    ...memory,
    itemSizeUnits: { ...memory.itemSizeUnits, [key]: trimmed },
  });
}

export function readRememberedSizeUnit(ownerId: string, itemName: string): string | undefined {
  const memory = readAddPriceMemory(ownerId);
  return memory.itemSizeUnits[itemNameKey(itemName)];
}
