import { MEALDB } from '../../config/mealdb';
import type { MealDbCatalogCategory } from '../../config/recipesTabSurface';
import type { RecipesTabRow } from '../../config/recipesTabFilters';
import type { PantryItem } from '../../types/mealprep';
import { readJson, writeJson } from '../storage';

interface CategorySnapshot {
  rows: RecipesTabRow[];
  expiresAt: number;
}

function categorySnapshotKey(category: MealDbCatalogCategory, pantry: PantryItem[]): string {
  const pantryKey = pantry
    .map((item) => item.name.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join('|');
  return `category:${category}:${pantryKey}`;
}

export function readMealDbCategorySnapshot(
  category: MealDbCatalogCategory,
  pantry: PantryItem[],
): RecipesTabRow[] {
  const key = categorySnapshotKey(category, pantry);
  const hit = readJson<CategorySnapshot | null>(`${MEALDB.cacheKeyPrefix}:${key}`, null);
  if (!hit?.rows?.length) return [];
  if (hit.expiresAt < Date.now()) return [];
  return hit.rows;
}

export function writeMealDbCategorySnapshot(
  category: MealDbCatalogCategory,
  pantry: PantryItem[],
  rows: RecipesTabRow[],
): void {
  if (rows.length === 0) return;
  const key = categorySnapshotKey(category, pantry);
  const entry: CategorySnapshot = {
    rows,
    expiresAt: Date.now() + MEALDB.filterCacheTtlMs,
  };
  writeJson(`${MEALDB.cacheKeyPrefix}:${key}`, entry);
}
