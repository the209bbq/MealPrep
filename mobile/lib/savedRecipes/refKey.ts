import type { Recipe } from '../../types/mealprep';
import { isMealDbRecipeId } from '../mealdb/normalize';
import { mealDbIdFromRecipeId } from '../mealdb/slug';
import { savedRefKeyCreator, savedRefKeyKitchen, savedRefKeyMealDb } from './keys';
import { mealDbIdFromKitchenRecipe } from './preview';

export function refKeyForKitchenRecipe(recipe: Recipe): string {
  const mealdbId = mealDbIdFromKitchenRecipe(recipe);
  if (mealdbId) return savedRefKeyMealDb(mealdbId);
  if (isMealDbRecipeId(recipe.id) || recipe.sourceType === 'themealdb') {
    const fromId = mealDbIdFromRecipeId(recipe.id);
    if (fromId) return savedRefKeyMealDb(fromId);
  }
  return savedRefKeyKitchen(recipe.id);
}

export function refKeyForCreatorVideo(videoId: string, importedRecipe: Recipe | null): string {
  if (importedRecipe) return refKeyForKitchenRecipe(importedRecipe);
  return savedRefKeyCreator(videoId);
}
