import { youtubeVideoIdFromUrl } from '../recipeImport/youtube';
import type { Recipe } from '../../types/mealprep';

/** Canonical key for matching imported recipes to external URLs (YouTube watch URLs, etc.). */
export function recipeSourceUrlKey(url: string): string {
  const trimmed = url.trim();
  const videoId = youtubeVideoIdFromUrl(trimmed);
  if (videoId) return `youtube:${videoId}`;
  return trimmed.toLowerCase();
}

export function findKitchenRecipeBySourceUrl(
  recipes: readonly Recipe[],
  sourceUrl: string,
): Recipe | undefined {
  const key = recipeSourceUrlKey(sourceUrl);
  return recipes.find((recipe) => recipe.sourceUrl && recipeSourceUrlKey(recipe.sourceUrl) === key);
}
