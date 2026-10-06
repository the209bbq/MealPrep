import { RECIPE_SOURCES } from '../../config/recipeSources';
import { catalogToRecipes } from '../../data/kitchenCatalog';
import { MEALDB_CATALOG_CATEGORIES } from '../../config/recipesTabSurface';
import { readMealDbCatalogSnapshot } from '../mealdb/catalogCache';
import { readMealDbCategorySnapshot } from '../mealdb/categoryFeedCache';
import { readCachedMealDbAppRecipe } from '../mealdb/client';
import { isMealDbRecipeId } from '../mealdb/normalize';
import { readRememberedMealDbRecipes } from '../mealdb/plannedRecipeStore';
import type { MealPlanItem, PantryItem, Recipe } from '../../types/mealprep';

let cachedCatalogRecipes: Recipe[] | null = null;

/** Built-in kitchen catalog (same rows as Supabase master import). */
export function builtInKitchenCatalogRecipes(): Recipe[] {
  if (!cachedCatalogRecipes) {
    cachedCatalogRecipes = catalogToRecipes();
  }
  return cachedCatalogRecipes;
}

/**
 * Account/imported recipes merged with the built-in catalog (account row wins on slug/id collision).
 * Used for pantry matching outside the Recipes tab feed when library rows are not loaded yet.
 */
export function kitchenRecipesForPantryMatch(accountRecipes: Recipe[]): Recipe[] {
  const byId = new Map<string, Recipe>();
  for (const recipe of builtInKitchenCatalogRecipes()) {
    byId.set(recipe.id, recipe);
  }
  for (const recipe of accountRecipes) {
    byId.set(recipe.id, recipe);
  }
  return [...byId.values()];
}

/**
 * Recipes tab + meal-plan resolution: MealPlanatic library, optional built-in fallback, then account imports.
 */
export function recipesForRecipesFeed(
  accountRecipes: Recipe[],
  libraryRecipes: readonly Recipe[],
): Recipe[] {
  const byId = new Map<string, Recipe>();
  const showBuiltIn =
    RECIPE_SOURCES.builtInCatalogWhenLibraryEmpty && libraryRecipes.length === 0;

  if (showBuiltIn) {
    for (const recipe of builtInKitchenCatalogRecipes()) {
      byId.set(recipe.id, recipe);
    }
  }

  if (RECIPE_SOURCES.libraryRecipesEnabled) {
    for (const recipe of libraryRecipes) {
      byId.set(recipe.id, recipe);
    }
  }

  for (const recipe of accountRecipes) {
    byId.set(recipe.id, recipe);
  }
  return [...byId.values()];
}

function mergeRecipesById(base: Recipe[], extras: Iterable<Recipe>): Recipe[] {
  const byId = new Map(base.map((recipe) => [recipe.id, recipe]));
  for (const recipe of extras) {
    byId.set(recipe.id, recipe);
  }
  return [...byId.values()];
}

/**
 * Kitchen recipes used for meal plan, grocery rebuild, pantry match, and cook confirmation —
 * includes Classic (MealDB) rows from catalog cache, planned snapshots, and lookup cache.
 */
export function kitchenRecipesWithMealPlanContext(
  accountRecipes: Recipe[],
  libraryRecipes: readonly Recipe[],
  pantry: PantryItem[],
  mealPlan: MealPlanItem[],
): Recipe[] {
  const base = recipesForRecipesFeed(accountRecipes, libraryRecipes);
  const extras: Recipe[] = [];

  for (const row of readMealDbCatalogSnapshot(pantry)) {
    if (row.kind === 'kitchen') extras.push(row.recipe);
  }

  for (const category of MEALDB_CATALOG_CATEGORIES) {
    for (const row of readMealDbCategorySnapshot(category, pantry)) {
      if (row.kind !== 'kitchen') continue;
      if (row.pantryMatchPending) continue;
      extras.push(row.recipe);
    }
  }
  extras.push(...readRememberedMealDbRecipes());

  for (const item of mealPlan) {
    const slug = item.recipeSlug;
    if (!slug || !isMealDbRecipeId(slug)) continue;
    if (base.some((recipe) => recipe.id === slug) || extras.some((recipe) => recipe.id === slug)) {
      continue;
    }
    const cached = readCachedMealDbAppRecipe(slug);
    if (cached) extras.push(cached);
  }

  return mergeRecipesById(base, extras);
}
