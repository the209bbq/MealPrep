import type { Recipe } from '../types/mealprep';
import type { RecipeDiscoveryListItem } from '../lib/recipeDiscovery/types';

/** Derived difficulty bucket for Recipes tab filters (not diet). */
export type RecipesTabDifficultyBucket = 'easy' | 'medium' | 'hard';

/**
 * Kitchen recipes have no API difficulty — score from ingredient + step counts.
 * Discovery recipes prefer RecipeAPI `difficulty` when set.
 */
export const RECIPES_TAB_DIFFICULTY_THRESHOLDS = {
  easyMaxIngredients: 6,
  easyMaxSteps: 4,
  mediumMaxIngredients: 11,
  mediumMaxSteps: 8,
} as const;

function bucketFromCounts(ingredientCount: number, stepCount: number): RecipesTabDifficultyBucket {
  const { easyMaxIngredients, easyMaxSteps, mediumMaxIngredients, mediumMaxSteps } =
    RECIPES_TAB_DIFFICULTY_THRESHOLDS;
  if (ingredientCount <= easyMaxIngredients && stepCount <= easyMaxSteps) return 'easy';
  if (ingredientCount <= mediumMaxIngredients && stepCount <= mediumMaxSteps) return 'medium';
  return 'hard';
}

function apiDifficultyToBucket(value: string | undefined | null): RecipesTabDifficultyBucket | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === 'easy') return 'easy';
  if (normalized === 'medium') return 'medium';
  if (normalized === 'hard') return 'hard';
  return null;
}

export function recipesTabKitchenDifficulty(recipe: Recipe): RecipesTabDifficultyBucket {
  const ingredientCount = recipe.ingredients?.length ?? 0;
  const stepCount = recipe.steps?.length ?? 0;
  return bucketFromCounts(ingredientCount, stepCount);
}

export function recipesTabDiscoveryDifficulty(item: RecipeDiscoveryListItem): RecipesTabDifficultyBucket {
  const fromApi = apiDifficultyToBucket(item.difficulty);
  if (fromApi) return fromApi;
  const ingredientCount = item.ingredients?.length ?? 0;
  const stepCount = item.instructions?.length ?? 0;
  return bucketFromCounts(ingredientCount, stepCount);
}
