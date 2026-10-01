import { readJson, writeJson } from '../storage';

type PersistentRow<T> = {
  value: T;
  expiresAt: number;
};

const KEY_PREFIX = 'mealprep.osmCache.';

function storageKey(key: string): string {
  return `${KEY_PREFIX}${key}`;
}

export function readPersistentCache<T>(key: string): T | undefined {
  const row = readJson<PersistentRow<T> | null>(storageKey(key), null);
  if (!row) return undefined;
  if (Date.now() > row.expiresAt) return undefined;
  return row.value;
}

/** Returns cached value even when TTL expired (for offline / API failure fallback). */
export function readPersistentCacheStale<T>(key: string): T | undefined {
  const row = readJson<PersistentRow<T> | null>(storageKey(key), null);
  return row?.value;
}

export function writePersistentCache<T>(key: string, value: T, ttlMs: number): void {
  writeJson(storageKey(key), {
    value,
    expiresAt: Date.now() + ttlMs,
  } satisfies PersistentRow<T>);
}
