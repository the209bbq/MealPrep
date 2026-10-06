import { MEALDB } from '../../config/mealdb';
import type { PantryItem } from '../../types/mealprep';
import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { listStorageKeysWithPrefix, readJson, removeStorageKey, writeJson } from '../storage';
import { mealDbPantryProteinFilters } from './pantryProteins';

interface CatalogSnapshot {
  rows: RecipesTabRow[];
  expiresAt: number;
}

function catalogSnapshotKey(pantry: PantryItem[]): string {
  const filters = mealDbPantryProteinFilters(pantry, MEALDB.maxPantryFilterQueries);
  const pantryKey = pantry
    .map((item) => item.name.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join('|');
  return `catalog:${filters.join(',')}:${pantryKey}`;
}

export function readMealDbCatalogSnapshot(pantry: PantryItem[]): RecipesTabRow[] {
  const key = catalogSnapshotKey(pantry);
  const hit = readJson<CatalogSnapshot | null>(`${MEALDB.cacheKeyPrefix}:${key}`, null);
  if (!hit?.rows?.length) return [];
  return hit.rows;
}

export function writeMealDbCatalogSnapshot(pantry: PantryItem[], rows: RecipesTabRow[]): void {
  if (rows.length === 0) return;
  const key = catalogSnapshotKey(pantry);
  const entry: CatalogSnapshot = {
    rows,
    expiresAt: Date.now() + MEALDB.filterCacheTtlMs,
  };
  writeJson(`${MEALDB.cacheKeyPrefix}:${key}`, entry);
}

export function clearAllMealDbCatalogSnapshots(): void {
  const prefix = `${MEALDB.cacheKeyPrefix}:catalog:`;
  for (const key of listStorageKeysWithPrefix(prefix)) {
    removeStorageKey(key);
  }
}

export function resetMealDbCatalogSnapshotForTests(): void {
  clearAllMealDbCatalogSnapshots();
}
