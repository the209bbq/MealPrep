const bucket = new Map<string, { value: unknown; expiresAt: number }>();

export function readCache<T>(key: string): T | undefined {
  const row = bucket.get(key);
  if (!row) return undefined;
  if (Date.now() > row.expiresAt) {
    bucket.delete(key);
    return undefined;
  }
  return row.value as T;
}

export function writeCache<T>(key: string, value: T, ttlMs: number): void {
  bucket.set(key, { value, expiresAt: Date.now() + ttlMs });
}
