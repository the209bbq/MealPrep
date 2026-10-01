function memory(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

let cached: StorageLike | null = null;

function getStore(): StorageLike {
  if (cached) return cached;
  if (typeof globalThis.localStorage !== 'undefined') {
    cached = globalThis.localStorage;
    return cached;
  }
  cached = memory();
  return cached;
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = getStore().getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    getStore().setItem(key, JSON.stringify(value));
  } catch {
    // Demo persistence is best-effort (private mode / quota).
  }
}

export function removeStorageKey(key: string): void {
  try {
    getStore().removeItem(key);
  } catch {
    // Best-effort.
  }
}
