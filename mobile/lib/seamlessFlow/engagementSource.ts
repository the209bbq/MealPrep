import { isMealDbRecipeId } from '../mealdb/normalize';
import type { Recipe } from '../../types/mealprep';
import type { RecipeEngagementSource } from '../recipeRanking/types';

const CREATOR_SOURCE_TYPES = new Set([
  'youtube',
  'tiktok',
  'instagram',
  'facebook',
  'reddit',
  'video',
]);

export function engagementSourceFromRecipe(
  recipe: Pick<Recipe, 'id' | 'sourceType' | 'sourceUrl'>,
): RecipeEngagementSource {
  if (recipe.sourceType === 'themealdb' || isMealDbRecipeId(recipe.id)) {
    return 'mealdb';
  }
  if (recipe.sourceType && CREATOR_SOURCE_TYPES.has(recipe.sourceType)) {
    return 'creator';
  }
  if (recipe.id.startsWith('viral-preview-')) {
    return 'creator';
  }
  if (recipe.sourceUrl) {
    return 'import';
  }
  return 'import';
}
