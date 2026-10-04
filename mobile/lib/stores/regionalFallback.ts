import { haversineMiles } from '../../config/smartShop';
import { loadRegionalStaticGroceryStores } from './regionalStaticStores';
import type { StoreRecord } from './types';

/** Oakdale, CA — center of bundled offline fallback snapshot. */
export const OAKDALE_FALLBACK_ORIGIN = { lat: 37.7666, lng: -120.8472 };

const OAKDALE_FALLBACK_MAX_MILES = 60 / 1.609344; // ~60 km

export function isWithinOakdaleRegionalFallback(origin: { lat: number; lng: number }): boolean {
  return haversineMiles(origin, OAKDALE_FALLBACK_ORIGIN) <= OAKDALE_FALLBACK_MAX_MILES;
}

export function chooseRegionalStaticFallback(origin: { lat: number; lng: number }): StoreRecord[] {
  if (!isWithinOakdaleRegionalFallback(origin)) return [];
  return loadRegionalStaticGroceryStores();
}
