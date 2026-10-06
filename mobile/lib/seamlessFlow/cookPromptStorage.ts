import { readJson, writeJson } from '../storage';

const STORAGE_PREFIX = 'mealprep.cookPromptAsked';

function storageKey(ownerId: string): string {
  if (!ownerId || ownerId === 'guest') {
    return `${STORAGE_PREFIX}.guest`;
  }
  return `${STORAGE_PREFIX}.${ownerId}`;
}

export function readCookPromptAskedKeys(ownerId: string): Set<string> {
  const raw = readJson<string[]>(storageKey(ownerId), []);
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((key) => typeof key === 'string' && key.length > 0));
}

export function markCookPromptAsked(ownerId: string, promptKey: string): void {
  const trimmed = promptKey.trim();
  if (!trimmed) return;
  const existing = readCookPromptAskedKeys(ownerId);
  if (existing.has(trimmed)) return;
  existing.add(trimmed);
  writeJson(storageKey(ownerId), [...existing]);
}
