import { SMART_SHOP_STORES } from '../../config/smartShop';
import { readCache, writeCache } from './cache';
import { nearbyStoresCacheGeohash } from './geohash';
import { readPersistentCache, readPersistentCacheStale, writePersistentCache } from './osmPersistentCache';
import type { StoreRecord } from './types';

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function nearbyStoresCacheKey(origin: { lat: number; lng: number }, radiusM: number): string {
  const gh = nearbyStoresCacheGeohash(origin.lat, origin.lng);
  return `stores:nearby:v1:${gh}:${radiusM}`;
}

export function readCachedNearbyStores(
  origin: { lat: number; lng: number },
  radiusM: number,
): StoreRecord[] | undefined {
  const key = nearbyStoresCacheKey(origin, radiusM);
  const memory = readCache<StoreRecord[]>(key);
  if (memory?.length) return memory;
  const persistent = readPersistentCache<StoreRecord[]>(key);
  if (persistent?.length) {
    writeCache(key, persistent, SMART_SHOP_STORES.cacheTtlMs);
    return persistent;
  }
  return undefined;
}

export function readCachedNearbyStoresStale(
  origin: { lat: number; lng: number },
  radiusM: number,
): StoreRecord[] | undefined {
  const key = nearbyStoresCacheKey(origin, radiusM);
  const fresh = readCachedNearbyStores(origin, radiusM);
  if (fresh?.length) return fresh;
  return readPersistentCacheStale<StoreRecord[]>(key);
}

export function writeCachedNearbyStores(
  origin: { lat: number; lng: number },
  radiusM: number,
  stores: StoreRecord[],
): void {
  const key = nearbyStoresCacheKey(origin, radiusM);
  writeCache(key, stores, SMART_SHOP_STORES.cacheTtlMs);
  writePersistentCache(key, stores, TTL_MS);
}
