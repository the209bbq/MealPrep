import { RECIPE_IMPORT_COPY } from '../../config/recipeImport';
import type { RecipeDiscoveryListItem } from '../recipeDiscovery/types';
import type { Recipe } from '../../types/mealprep';
import { sourceCreditFromRecipe } from '../recipeImport/sourceCredit';
import {
  sanitizeRecipeImageUrl,
  youtubeThumbnailUrlFromWatchUrl,
} from '../recipeImport/youtubeThumbnail';

export function resolveKitchenRecipeImageUrl(recipe: Recipe): string | null {
  const stored = sanitizeRecipeImageUrl(recipe.imageUrl);
  if (stored) return stored;
  if (recipe.sourceType === 'youtube') {
    return youtubeThumbnailUrlFromWatchUrl(recipe.sourceUrl);
  }
  return null;
}

export function resolveDiscoveryRecipeImageUrl(recipe: RecipeDiscoveryListItem): string | null {
  const withImage = recipe as RecipeDiscoveryListItem & { image_url?: string | null };
  return sanitizeRecipeImageUrl(withImage.image_url);
}

export function recipeFeedMetaLine(
  minutes: number,
  servings: number,
  creatorName?: string | null,
): string {
  const timePart = `${Math.max(1, minutes)} min · ${Math.max(1, servings)} servings`;
  const name = creatorName?.trim();
  if (!name) return timePart;
  return `${timePart} · ${RECIPE_IMPORT_COPY.byCreator(name)}`;
}

export function kitchenRecipeFeedMetaLine(recipe: Recipe): string {
  const credit = sourceCreditFromRecipe(recipe);
  return recipeFeedMetaLine(recipe.minutes, recipe.servings, credit.creatorName);
}

export function discoveryRecipeFeedMetaLine(recipe: RecipeDiscoveryListItem): string {
  const minutes = Math.max(1, (recipe.prep_time ?? 0) + (recipe.cook_time ?? 0));
  return recipeFeedMetaLine(minutes, recipe.servings);
}
