import type { MealDbCatalogCategory } from '../../config/recipesTabSurface';
import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { filterRecipesTabRowsForDietPrefs } from '../diet/filterRows';
import type { UserDietPrefs } from '../diet/types';
import type { PantryItem } from '../../types/mealprep';
import { compareRecipePantryMatches, scoreRecipeAgainstPantry } from '../recipeMatch';
import { mealDbFetchCategories, mealDbFilterByCategory, mealDbLookupMeals } from './client';
import { readMealDbCategorySnapshot, writeMealDbCategorySnapshot } from './categoryFeedCache';
import { mealDbMealToAppRecipe } from './normalize';
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

export async function fetchMealDbCategoryFeedRows(
  category: MealDbCatalogCategory,
  pantry: PantryItem[],
): Promise<RecipesTabRow[]> {
  const cached = readMealDbCategorySnapshot(category, pantry);
  if (cached.length > 0) return cached;

  const ids = await mealDbFilterByCategory(category);
  const meals = await mealDbLookupMeals(ids.slice(0, 40));
  const rows: RecipesTabRow[] = meals.map((meal) => {
    const recipe = mealDbMealToAppRecipe(meal);
    return {
      kind: 'kitchen',
      recipe,
      match: scoreRecipeAgainstPantry(recipe, pantry),
    };
  });
  rows.sort((a, b) => compareRecipePantryMatches(a.match, b.match));
  if (rows.length > 0) {
    writeMealDbCategorySnapshot(category, pantry, rows);
  }
  return rows;
}
