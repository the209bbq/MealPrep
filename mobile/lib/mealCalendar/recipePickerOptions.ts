import type { Recipe } from '../../types/mealprep';
import { kitchenRecipesForPantryMatch, type RecipePantryMatch } from '../recipeMatch';

export interface MealPickerRecipeOption {
  recipeId: string;
  title: string;
  pantryPercent: number;
  matchedCount: number;
}

export function buildMealPickerRecipeOptions(
  recipes: Recipe[],
  rankedMatches: RecipePantryMatch[],
  maxRecipes: number,
): MealPickerRecipeOption[] {
  const kitchen = kitchenRecipesForPantryMatch(recipes);
  const byId = new Map(rankedMatches.map((row) => [row.recipeId, row]));
  const rankedIds = rankedMatches.map((row) => row.recipeId);
  const rankedSet = new Set(rankedIds);
  const rest = kitchen
    .filter((recipe) => !rankedSet.has(recipe.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((recipe) => recipe.id);
  const orderedIds = [...rankedIds, ...rest].slice(0, maxRecipes);
  return orderedIds.map((recipeId) => {
    const recipe = kitchen.find((row) => row.id === recipeId);
    const match = byId.get(recipeId);
    return {
      recipeId,
      title: recipe?.name ?? recipeId,
      pantryPercent: match?.percentMatch ?? 0,
      matchedCount: match?.matchedCount ?? 0,
    };
  });
}
