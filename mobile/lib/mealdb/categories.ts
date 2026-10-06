import type { MealDbCatalogCategory } from '../../config/recipesTabSurface';
import type { MealDbFilterMealSummary, MealDbMealDetail } from './types';
import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { filterRecipesTabRowsForDietPrefs } from '../diet/filterRows';
import type { UserDietPrefs } from '../diet/types';
import type { PantryItem } from '../../types/mealprep';
import { compareRecipePantryMatches, scoreRecipeAgainstPantry } from '../recipeMatch';
import {
  invalidateMealDbFilterCacheForCategory,
  mealDbFetchCategories,
  mealDbFilterByCategory,
  mealDbFilterSummariesByCategory,
  mealDbLookupMeals,
} from './client';
import { readMealDbCategorySnapshot, writeMealDbCategorySnapshot } from './categoryFeedCache';
import {
  clearMealDbCategoryListSnapshot,
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
  /** Max detail lookups to await before returning (stubs include the full filter list). */
  detailLimit?: number;
  lookupConcurrency?: number;
  /** Skip persisted category list cache (retry after failure). */
  bypassListCache?: boolean;
  /** Only fetch filter.php list — no meal lookups (home refresh). */
  listOnly?: boolean;
}

export interface MealDbCategoryFeedResult {
  rows: RecipesTabRow[];
  listFetchFailed: boolean;
}

async function mealDbCategoryFilterSummaries(
  category: MealDbCatalogCategory,
  bypassListCache: boolean,
): Promise<{ summaries: MealDbFilterMealSummary[]; listFetchFailed: boolean }> {
  if (!bypassListCache) {
    const cached = readMealDbCategoryListSnapshot(category);
    if (cached.length > 0) return { summaries: cached, listFetchFailed: false };
  } else {
    clearMealDbCategoryListSnapshot(category);
    invalidateMealDbFilterCacheForCategory(category);
  }

  const summaries = await mealDbFilterSummariesByCategory(category);
  if (summaries === null) {
    return { summaries: [], listFetchFailed: true };
  }
  if (summaries.length > 0) {
    writeMealDbCategoryListSnapshot(category, summaries);
  }
  return { summaries, listFetchFailed: false };
}

function mealIdsNeedingLookup(
  summaries: readonly MealDbFilterMealSummary[],
  rows: readonly RecipesTabRow[],
): string[] {
  const resolvedIds = new Set(
    rows
      .filter((row) => row.kind === 'kitchen' && !row.pantryMatchPending)
      .map((row) => String(row.recipe.id).replace(/^mealdb-/, '')),
  );
  return summaries
    .map((row) => row.idMeal.trim())
    .filter((idMeal) => idMeal.length > 0 && !resolvedIds.has(idMeal));
}

export async function fetchMealDbCategoryFeedRows(
  category: MealDbCatalogCategory,
  pantry: PantryItem[],
  options?: FetchMealDbCategoryFeedOptions,
): Promise<MealDbCategoryFeedResult> {
  const lookupBudget = options?.detailLimit ?? Number.POSITIVE_INFINITY;
  const bypassListCache = options?.bypassListCache ?? false;
  const cached = readMealDbCategorySnapshot(category, pantry);
  if (cached.length > 0) {
    options?.onRows?.(cached);
  }

  const { summaries, listFetchFailed } = await mealDbCategoryFilterSummaries(
    category,
    bypassListCache,
  );
  if (listFetchFailed) {
    return { rows: cached.length > 0 ? cached : [], listFetchFailed: true };
  }

  if (options?.listOnly) {
    const listRows =
      cached.length > 0 ? cached : recipesTabRowsFromFilterSummaries(summaries, category);
    if (listRows.length > 0) {
      options?.onRows?.(listRows);
    }
    return { rows: listRows, listFetchFailed: false };
  }

  let rows =
    cached.length > 0 ? [...cached] : recipesTabRowsFromFilterSummaries(summaries, category);
  if (rows.length > 0 && cached.length === 0) {
    options?.onRows?.(rows);
  }

  const ids = mealIdsNeedingLookup(summaries, rows);
  if (ids.length === 0) {
    return { rows, listFetchFailed: false };
  }

  const awaitIds = ids.slice(0, lookupBudget);
  const backgroundIds = ids.slice(lookupBudget);

  const mealsAcc: MealDbMealDetail[] = [];
  const lookupConcurrency = options?.lookupConcurrency ?? MEALDB.maxConcurrentRequests;

  const applyMeal = (meal: MealDbMealDetail) => {
    mealsAcc.push(meal);
    rows = mergeMealDetailIntoCategoryRows(rows, meal, pantry);
    options?.onRows?.(rows);
  };

  await mealDbLookupMeals(awaitIds, {
    concurrency: lookupConcurrency,
    onMeal: applyMeal,
  });

  if (mealsAcc.length > 0) {
    options?.onRows?.(rows);
    writeMealDbCategorySnapshot(category, pantry, rows);
  }

  if (backgroundIds.length > 0) {
    void mealDbLookupMeals(backgroundIds, {
      concurrency: lookupConcurrency,
      onMeal: (meal) => {
        rows = mergeMealDetailIntoCategoryRows(rows, meal, pantry);
        options?.onRows?.(rows);
        writeMealDbCategorySnapshot(category, pantry, rows);
      },
    });
  }

  return { rows, listFetchFailed: false };
}
