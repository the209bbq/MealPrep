import { getWebBasePath } from '../webBasePath';

/** Public web URL for deep-linking recipes from calendar exports. */
export function buildRecipeAppLink(recipeId: string): string {
  const base = getWebBasePath().replace(/\/$/, '');
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://mealplanatic.app';
  return `${origin}${base}/recipes?recipeId=${encodeURIComponent(recipeId)}`;
}
