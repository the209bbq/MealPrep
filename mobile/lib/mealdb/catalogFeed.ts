import { MEALDB } from '../../config/mealdb';
import { mapWithConcurrency } from '../concurrency';
import { compareRecipePantryMatches, scoreRecipeAgainstPantry } from '../recipeMatch';
import type { PantryItem, Recipe } from '../../types/mealprep';
import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { mealDbFilterByIngredient, mealDbLookupMeals } from './client';
import { readMealDbCatalogSnapshot, writeMealDbCatalogSnapshot } from './catalogCache';
import { mealDbIdsForEmptyPantryBrowse } from './catalogBrowse';
import { mealDbMealToAppRecipe } from './normalize';
import { mealDbPantryProteinFilters } from './pantryProteins';
import type { MealDbMealDetail } from './types';

export interface MealDbCatalogResult {
  rows: RecipesTabRow[];
  errorMessage: string | null;
}

export interface MealDbCatalogFetchOptions {
  onRows?: (rows: RecipesTabRow[]) => void;
}

async function collectMealIdsForPantry(pantry: PantryItem[]): Promise<string[]> {
  const filters = mealDbPantryProteinFilters(pantry, MEALDB.maxPantryFilterQueries);
  if (filters.length === 0) {
    return mealDbIdsForEmptyPantryBrowse();
  }

  const idSets = await mapWithConcurrency(filters, MEALDB.maxConcurrentRequests, (filter) =>
    mealDbFilterByIngredient(filter),
  );

  const counts = new Map<string, number>();
  for (const ids of idSets) {
    for (const id of ids) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, MEALDB.maxCatalogMeals);
}

function rowsFromMeals(meals: MealDbMealDetail[], pantry: PantryItem[]): RecipesTabRow[] {
  const recipes: Recipe[] = meals.map((meal) => mealDbMealToAppRecipe(meal));
  const rows: RecipesTabRow[] = recipes.map((recipe) => {
    const match = scoreRecipeAgainstPantry(recipe, pantry);
    return { kind: 'kitchen', recipe, match };
  });
  rows.sort((a, b) => compareRecipePantryMatches(a.match, b.match));
  return rows;
}

export async function fetchMealDbCatalogRows(
  pantry: PantryItem[],
  options?: MealDbCatalogFetchOptions,
): Promise<MealDbCatalogResult> {
  const cachedRows = readMealDbCatalogSnapshot(pantry);
  if (cachedRows.length > 0) {
    options?.onRows?.(cachedRows);
  }

  try {
    const ids = await collectMealIdsForPantry(pantry);
    const capped = ids.slice(0, MEALDB.maxCatalogMeals);
    const mealsAcc: MealDbMealDetail[] = [];

    await mealDbLookupMeals(capped, {
      onMeal: (meal) => {
        mealsAcc.push(meal);
        options?.onRows?.(rowsFromMeals(mealsAcc, pantry));
      },
    });

    const rows = rowsFromMeals(mealsAcc, pantry);
    if (rows.length > 0) {
      writeMealDbCatalogSnapshot(pantry, rows);
    }
    return { rows, errorMessage: rows.length === 0 ? null : null };
  } catch {
    if (cachedRows.length > 0) {
      return { rows: cachedRows, errorMessage: null };
    }
    return { rows: [], errorMessage: 'Could not load classic recipes right now.' };
  }
}

export function mealDbRowsFromRecipes(
  recipes: Recipe[],
  pantry: PantryItem[],
): RecipesTabRow[] {
  const rows = recipes.map((recipe) => ({
    kind: 'kitchen' as const,
    recipe,
    match: scoreRecipeAgainstPantry(recipe, pantry),
  }));
  rows.sort((a, b) => compareRecipePantryMatches(a.match, b.match));
  return rows;
}
