import type { Recipe } from '../../types/mealprep';
import { kitchenRecipesForPantryMatch } from '../recipeMatch/kitchenCatalogMerge';

/** Resolve a kitchen/catalog/guest recipe row by id (meal plan, picker, toggles). */
export function findKitchenRecipeById(accountRecipes: Recipe[], recipeId: string): Recipe | undefined {
  return kitchenRecipesForPantryMatch(accountRecipes).find((row) => row.id === recipeId);
}

export function resolveKitchenRecipeTitle(accountRecipes: Recipe[], recipeId: string): string {
  return findKitchenRecipeById(accountRecipes, recipeId)?.name ?? recipeId;
}
