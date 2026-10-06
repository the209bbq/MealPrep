import { MEALDB } from '../../config/mealdb';
import { mapWithConcurrency } from '../concurrency';
import { mealDbFilterByIngredient, mealDbSearchByName } from './client';

const EMPTY_PANTRY_EXTRA_SEARCHES = ['curry', 'thai', 'salmon', 'pasta'] as const;

const EMPTY_PANTRY_CATEGORY_FILTERS = [
  'Chicken',
  'Beef',
  'Pork',
  'Seafood',
  'Pasta',
  'Vegetarian',
  'Breakfast',
  'Dessert',
] as const;

let emptyPantryCatalogIdsCache: string[] | null = null;

/**
 * TheMealDB browse set when the pantry is empty (deduped, ~20–40 meals).
 * Cached in memory for the session.
 */
export async function mealDbIdsForEmptyPantryBrowse(): Promise<string[]> {
  if (emptyPantryCatalogIdsCache?.length) {
    return emptyPantryCatalogIdsCache;
  }

  const categorySets = await mapWithConcurrency(
    EMPTY_PANTRY_CATEGORY_FILTERS,
    MEALDB.maxConcurrentRequests,
    (category) => mealDbFilterByIngredient(category),
  );
  const searchSets = await mapWithConcurrency(
    EMPTY_PANTRY_EXTRA_SEARCHES,
    MEALDB.maxConcurrentRequests,
    (term) => mealDbSearchByName(term),
  );
  const idSets = [...categorySets, ...searchSets];

  const seen = new Set<string>();
  const merged: string[] = [];
  for (const ids of idSets) {
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(id);
      if (merged.length >= MEALDB.maxCatalogMeals * 2) break;
    }
  }

  emptyPantryCatalogIdsCache = merged.slice(0, Math.max(MEALDB.maxCatalogMeals, 24));
  return emptyPantryCatalogIdsCache;
}

export function resetMealDbEmptyPantryBrowseCache(): void {
  emptyPantryCatalogIdsCache = null;
}
