import type { Recipe } from '../../types/mealprep';
import { isUserImportedKitchenRecipe } from '../recipeImport/mapToAppRecipe';
import { recipesForRecipesFeed } from '../recipeMatch/kitchenCatalogMerge';
import type { RecipePantryMatch } from '../recipeMatch';
import { mapNormalizedRecipeToAppRecipe } from '../recipes/normalizedRecipeShape';
import { mealDbRecipeId } from '../mealdb/slug';
import { savedKitchenRecipeIdsFromRecords } from '../savedRecipes/pickerRecipeIds';
import type { SavedRecipeRecord } from '../savedRecipes/types';

export interface MealPickerRecipeOption {
  recipeId: string;
  title: string;
  pantryPercent: number;
  matchedCount: number;
  missingCount: number;
  isSaved: boolean;
}

function kitchenCatalogWithSavedBookmarks(
  feedKitchenRecipes: readonly Recipe[],
  savedRecords: readonly SavedRecipeRecord[],
): Recipe[] {
  const byId = new Map(feedKitchenRecipes.map((recipe) => [recipe.id, recipe]));
  for (const record of savedRecords) {
    if (record.preview.kind === 'mealdb') {
      const shape = record.preview.shape;
      const id = shape.id.startsWith('mealdb-') ? shape.id : mealDbRecipeId(shape.id);
      const recipe = mapNormalizedRecipeToAppRecipe({ ...shape, id });
      if (!byId.has(recipe.id)) byId.set(recipe.id, recipe);
    }
    const kitchenId = record.kitchenRecipeId;
    if (kitchenId && !byId.has(kitchenId)) {
      const fromFeed = feedKitchenRecipes.find((row) => row.id === kitchenId);
      if (fromFeed) byId.set(kitchenId, fromFeed);
    }
  }
  return [...byId.values()];
}

export function buildMealPickerRecipeOptions(
  feedKitchenRecipes: readonly Recipe[],
  rankedMatches: RecipePantryMatch[],
  maxRecipes: number,
  savedRecipeIds: ReadonlySet<string>,
  savedRecords: readonly SavedRecipeRecord[] = [],
): MealPickerRecipeOption[] {
  const kitchen = kitchenCatalogWithSavedBookmarks(feedKitchenRecipes, savedRecords);
  const savedIds = savedRecipeIds.size > 0 ? savedRecipeIds : savedKitchenRecipeIdsFromRecords(savedRecords);
  const byId = new Map(rankedMatches.map((row) => [row.recipeId, row]));
  const rankedIds = rankedMatches.map((row) => row.recipeId);
  const rankedSet = new Set(rankedIds);

  const savedFirst = kitchen
    .filter((recipe) => savedIds.has(recipe.id) || isUserImportedKitchenRecipe(recipe))
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
    const isSaved = savedIds.has(recipeId) || (recipe != null && isUserImportedKitchenRecipe(recipe));
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
