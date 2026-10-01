import { readJson, removeStorageKey, writeJson } from '../storage';
import { normalizeIngredientName } from '../recipeMatch/normalize';

const STORAGE_PREFIX = 'mealprep.groceryDismissals';

function storageKey(ownerId: string): string {
  return `${STORAGE_PREFIX}.${ownerId || 'demo-user'}`;
}

export function groceryDismissalKey(recipeId: string, ingredientName: string, unit: string): string {
  return `${recipeId}::${normalizeIngredientName(ingredientName)}::${unit.trim().toLowerCase()}`;
}

export function readGroceryDismissals(ownerId: string): Set<string> {
  const list = readJson<string[]>(storageKey(ownerId), []);
  return new Set(list);
}

export function addGroceryDismissals(ownerId: string, keys: string[]): void {
  if (keys.length === 0) return;
  const current = readGroceryDismissals(ownerId);
  for (const key of keys) current.add(key);
  writeJson(storageKey(ownerId), [...current]);
}

export function clearGroceryDismissals(ownerId: string): void {
  removeStorageKey(storageKey(ownerId));
}

export function isGroceryDismissed(
  dismissals: Set<string>,
  recipeId: string,
  ingredientName: string,
  unit: string,
): boolean {
  return dismissals.has(groceryDismissalKey(recipeId, ingredientName, unit));
}
