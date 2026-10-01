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
 * Used for pantry matching and the Recipes tab kitchen list for guests and signed-in users alike.
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
