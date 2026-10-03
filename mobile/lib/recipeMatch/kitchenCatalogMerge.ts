import { RECIPE_SOURCES } from '../../config/recipeSources';
import { catalogToRecipes } from '../../data/kitchenCatalog';
import type { Recipe } from '../../types/mealprep';

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
