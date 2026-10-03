import type { Recipe } from '../../types/mealprep';
import {
  kitchenRecipesForPantryMatch,
  recipesForRecipesFeed,
} from '../recipeMatch/kitchenCatalogMerge';

/** Resolve a kitchen/catalog/guest recipe row by id (meal plan, picker, toggles). */
export function findKitchenRecipeById(
  accountRecipes: Recipe[],
  recipeId: string,
  libraryRecipes: readonly Recipe[] = [],
): Recipe | undefined {
  const merged =
    libraryRecipes.length > 0
      ? recipesForRecipesFeed(accountRecipes, libraryRecipes)
      : kitchenRecipesForPantryMatch(accountRecipes);
  return merged.find((row) => row.id === recipeId);
}

export function resolveKitchenRecipeTitle(accountRecipes: Recipe[], recipeId: string): string {
  return findKitchenRecipeById(accountRecipes, recipeId)?.name ?? recipeId;
}
