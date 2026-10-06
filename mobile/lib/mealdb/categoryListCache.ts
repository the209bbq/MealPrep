import { MEALDB } from '../../config/mealdb';
import type { MealDbCatalogCategory } from '../../config/recipesTabSurface';
import { listStorageKeysWithPrefix, readJson, removeStorageKey, writeJson } from '../storage';
import type { MealDbFilterMealSummary } from './types';

interface CategoryListSnapshot {
  summaries: MealDbFilterMealSummary[];
  expiresAt: number;
}

function storageKey(category: MealDbCatalogCategory): string {
  return `${MEALDB.cacheKeyPrefix}:category-list:${category}`;
}

export function readMealDbCategoryListSnapshot(
  category: MealDbCatalogCategory,
): MealDbFilterMealSummary[] {
  const hit = readJson<CategoryListSnapshot | null>(storageKey(category), null);
  if (!hit?.summaries?.length) return [];
  if (hit.expiresAt < Date.now()) return [];
  return hit.summaries;
}

export function writeMealDbCategoryListSnapshot(
  category: MealDbCatalogCategory,
  summaries: readonly MealDbFilterMealSummary[],
): void {
  if (summaries.length === 0) return;
  const entry: CategoryListSnapshot = {
    summaries: [...summaries],
    expiresAt: Date.now() + MEALDB.filterCacheTtlMs,
  };
  writeJson(storageKey(category), entry);
}

export function clearAllMealDbCategoryListSnapshots(): void {
  const prefix = `${MEALDB.cacheKeyPrefix}:category-list:`;
  for (const key of listStorageKeysWithPrefix(prefix)) {
    removeStorageKey(key);
  }
}
