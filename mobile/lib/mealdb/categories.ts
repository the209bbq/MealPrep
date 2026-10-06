import type { MealDbCatalogCategory } from '../../config/recipesTabSurface';
import type { MealDbFilterMealSummary, MealDbMealDetail } from './types';
import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { filterRecipesTabRowsForDietPrefs } from '../diet/filterRows';
import type { UserDietPrefs } from '../diet/types';
import type { PantryItem } from '../../types/mealprep';
import { compareRecipePantryMatches, scoreRecipeAgainstPantry } from '../recipeMatch';
import {
  mealDbFetchCategories,
  mealDbFilterByCategory,
  mealDbFilterSummariesByCategory,
  mealDbLookupMeals,
} from './client';
import { readMealDbCategorySnapshot, writeMealDbCategorySnapshot } from './categoryFeedCache';
import {
  readMealDbCategoryListSnapshot,
  writeMealDbCategoryListSnapshot,
} from './categoryListCache';
import {
  mergeMealDetailIntoCategoryRows,
  recipesTabRowsFromFilterSummaries,
  rowsFromMealDetails,
} from './categoryStubRows';
import { mealDbMealToAppRecipe } from './normalize';
import { MEALDB } from '../../config/mealdb';
import { mealDbCategoryFromRecipeTag } from '../recipesTab/categoryDiet';
import { wontCookRefKeys } from '../recipeRanking/hardFilter';
import type { RecipeEngagementEvent } from '../recipeRanking/types';
import { refKeyFromRecipesTabRow } from '../recipeRanking/recipeInputs';

export interface MealDbCategoryMeta {
  category: MealDbCatalogCategory;
  thumbUrl: string | null;
}

export async function mealDbListCategories(): Promise<MealDbCategoryMeta[]> {
  const rows = await mealDbFetchCategories();
  return rows
    .map((row) => ({
      category: row.category as MealDbCatalogCategory,
      thumbUrl: row.thumbUrl,
    }))
    .filter((row) => row.category.length > 0);
}

function mealDbCategoryForRow(row: RecipesTabRow): string | null {
  if (row.kind === 'kitchen') {
    return mealDbCategoryFromRecipeTag(row.recipe.tag);
  }
  return mealDbCategoryFromRecipeTag(row.recipe.meal_type ?? row.recipe.cuisine ?? null);
}

export function countPassingRecipesForCategoryFromRows(
  category: string,
  rows: readonly RecipesTabRow[],
  prefs: UserDietPrefs,
  wontCook: ReadonlySet<string>,
): number {
  const inCategory = rows.filter((row) => mealDbCategoryForRow(row) === category);
  const diet = filterRecipesTabRowsForDietPrefs(inCategory, prefs);
  return diet.filter((row) => !wontCook.has(refKeyFromRecipesTabRow(row))).length;
}

export async function countPassingRecipesForCategory(
  category: MealDbCatalogCategory,
  prefs: UserDietPrefs,
  wontCook: ReadonlySet<string>,
  maxLookups = 12,
): Promise<number> {
  const ids = await mealDbFilterByCategory(category);
  if (ids.length === 0) return 0;
  const meals = await mealDbLookupMeals(ids.slice(0, maxLookups));
  let pass = 0;
  for (const meal of meals) {
    const recipe = mealDbMealToAppRecipe(meal);
    const row: RecipesTabRow = {
      kind: 'kitchen',
      recipe,
      match: {
        recipeId: recipe.id,
        recipeName: recipe.name,
        totalIngredients: recipe.ingredients.length,
        matchedCount: 0,
        missingCount: recipe.ingredients.length,
        percentMatch: 0,
        matched: [],
        missing: [],
      },
    };
    const filtered = filterRecipesTabRowsForDietPrefs([row], prefs);
    if (filtered.length === 0) continue;
    if (wontCook.has(refKeyFromRecipesTabRow(row))) continue;
    pass += 1;
    if (pass >= 3) return pass;
  }
  return pass;
}

export function wontCookSetFromEvents(events: readonly RecipeEngagementEvent[]): Set<string> {
  return wontCookRefKeys(events);
}

export interface FetchMealDbCategoryFeedOptions {
  onRows?: (rows: RecipesTabRow[]) => void;
  /** Cap detail lookups (prefetch uses a smaller window than full category browse). */
  detailLimit?: number;
  lookupConcurrency?: number;
}

async function mealDbCategoryFilterSummaries(
  category: MealDbCatalogCategory,
): Promise<MealDbFilterMealSummary[]> {
  const cached = readMealDbCategoryListSnapshot(category);
  if (cached.length > 0) return cached;

  const summaries = await mealDbFilterSummariesByCategory(category);
  if (summaries.length > 0) {
    writeMealDbCategoryListSnapshot(category, summaries);
  }
  return summaries;
}

export async function fetchMealDbCategoryFeedRows(
  category: MealDbCatalogCategory,
  pantry: PantryItem[],
  options?: FetchMealDbCategoryFeedOptions,
): Promise<RecipesTabRow[]> {
  const detailLimit = options?.detailLimit ?? MEALDB.homeCategoryFeedMealCount;
  const cached = readMealDbCategorySnapshot(category, pantry);
  if (cached.length >= detailLimit) {
    options?.onRows?.(cached);
    return cached;
  }
  if (cached.length > 0) {
    options?.onRows?.(cached);
  }

  const summaries = await mealDbCategoryFilterSummaries(category);
  const capped = summaries.slice(0, detailLimit);
  const cachedIds = new Set(
    cached.map((row) => (row.kind === 'kitchen' ? row.recipe.id : '')).filter(Boolean),
  );
  const ids = capped
    .map((row) => row.idMeal)
    .filter((idMeal) => !cachedIds.has(`mealdb-${idMeal.trim()}`));

  let rows =
    cached.length > 0
      ? [...cached]
      : recipesTabRowsFromFilterSummaries(capped, category);
  if (rows.length > 0 && cached.length === 0) {
    options?.onRows?.(rows);
  }

  if (ids.length === 0) {
    return rows;
  }

  const mealsAcc: MealDbMealDetail[] = [];
  await mealDbLookupMeals(ids, {
    concurrency: options?.lookupConcurrency ?? MEALDB.maxConcurrentRequests,
    onMeal: (meal) => {
      mealsAcc.push(meal);
      rows = mergeMealDetailIntoCategoryRows(rows, meal, pantry);
      options?.onRows?.(rows);
    },
  });

  if (mealsAcc.length > 0) {
    if (cached.length === 0) {
      rows = rowsFromMealDetails(mealsAcc, pantry);
    }
    options?.onRows?.(rows);
    writeMealDbCategorySnapshot(category, pantry, rows);
  }
  return rows;
}
