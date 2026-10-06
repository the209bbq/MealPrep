import type { Recipe } from '../../types/mealprep';
import { isUserImportedKitchenRecipe } from '../recipeImport/mapToAppRecipe';
import { recipesForRecipesFeed } from '../recipeMatch/kitchenCatalogMerge';
import type { RecipePantryMatch } from '../recipeMatch';

export interface MealPickerRecipeOption {
  recipeId: string;
  title: string;
  pantryPercent: number;
  matchedCount: number;
  missingCount: number;
  isSaved: boolean;
}

export function buildMealPickerRecipeOptions(
  feedKitchenRecipes: readonly Recipe[],
  rankedMatches: RecipePantryMatch[],
  maxRecipes: number,
  savedRecipeIds: ReadonlySet<string>,
): MealPickerRecipeOption[] {
  const kitchen = [...feedKitchenRecipes];
  const byId = new Map(rankedMatches.map((row) => [row.recipeId, row]));
  const rankedIds = rankedMatches.map((row) => row.recipeId);
  const rankedSet = new Set(rankedIds);

  const savedFirst = kitchen
    .filter((recipe) => savedRecipeIds.has(recipe.id) || isUserImportedKitchenRecipe(recipe))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((recipe) => recipe.id);

  const recommended = rankedIds.filter((id) => !savedFirst.includes(id));
  const rest = kitchen
    .filter((recipe) => !rankedSet.has(recipe.id) && !savedFirst.includes(recipe.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((recipe) => recipe.id);

  const orderedIds = [...new Set([...savedFirst, ...recommended, ...rest])].slice(0, maxRecipes);

  return orderedIds.map((recipeId) => {
    const recipe = kitchen.find((row) => row.id === recipeId);
    const match = byId.get(recipeId);
    const isSaved = savedRecipeIds.has(recipeId) || (recipe != null && isUserImportedKitchenRecipe(recipe));
    return {
      recipeId,
      title: recipe?.name ?? recipeId,
      pantryPercent: match?.percentMatch ?? 0,
      matchedCount: match?.matchedCount ?? 0,
      missingCount: match?.missingCount ?? 0,
      isSaved,
    };
  });
}

/** @deprecated Use feed kitchen list directly; kept for script imports. */
export function mealPickerKitchenRecipes(accountRecipes: Recipe[], libraryRecipes: readonly Recipe[]): Recipe[] {
  return recipesForRecipesFeed(accountRecipes, libraryRecipes);
}
