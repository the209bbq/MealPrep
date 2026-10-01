import type { PantryStorageLocation } from '../../config/pantryStorage';
import type { PantryVisionResponse } from './types';

const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX_ENTRIES = 48;

type CacheEntry = {
  at: number;
  response: PantryVisionResponse;
};

const memoryCache = new Map<string, CacheEntry>();

export function pantryScanCacheKey(
  imageHash: string,
  scanLocation: PantryStorageLocation,
  schemaVersion = 'v3',
): string {
  return `${schemaVersion}|${scanLocation}|${imageHash}`;
}

export function getCachedPantryScan(key: string): PantryVisionResponse | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return entry.response;
}

export function setCachedPantryScan(key: string, response: PantryVisionResponse): void {
  if (memoryCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = [...memoryCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) memoryCache.delete(oldest[0]);
  }
  memoryCache.set(key, { at: Date.now(), response });
}

export function clearPantryScanCache(): void {
  memoryCache.clear();
}
