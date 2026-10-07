import { readJson, writeJson } from '../storage';

const KEY_PREFIX = 'mealprep.hiddenImportedKitchen.';

function storageKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export function readHiddenImportedKitchenIds(userId: string): Set<string> {
  if (!userId) return new Set();
  const rows = readJson<string[] | null>(storageKey(userId), null);
  if (!Array.isArray(rows)) return new Set();
  return new Set(rows.filter((id) => typeof id === 'string' && id.length > 0));
}

export function writeHiddenImportedKitchenIds(userId: string, ids: ReadonlySet<string>): void {
  if (!userId) return;
  writeJson(storageKey(userId), [...ids]);
}
