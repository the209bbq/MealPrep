import { readJson, removeStorageKey, writeJson } from '../storage';
import type { SavedRecipeRecord } from './types';

const KEY_PREFIX = 'mealprep.accountSavedRecipes.';

function storageKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export function readAccountSavedRecipesCache(userId: string): SavedRecipeRecord[] | null {
  if (!userId) return null;
  const rows = readJson<SavedRecipeRecord[] | null>(storageKey(userId), null);
  return Array.isArray(rows) ? rows : null;
}

export function writeAccountSavedRecipesCache(userId: string, records: SavedRecipeRecord[]): void {
  if (!userId) return;
  writeJson(storageKey(userId), records);
}

export function clearAccountSavedRecipesCache(userId: string): void {
  if (!userId) return;
  removeStorageKey(storageKey(userId));
}
