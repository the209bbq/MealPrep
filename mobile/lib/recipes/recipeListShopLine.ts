import { RECIPES_COPY } from '../../config/recipesCopy';
import type { RecipePantryMatch } from '../recipeMatch';

/** One-line shop hint for recipe list cards (from precomputed pantry match). */
export function recipeListShopLine(match: RecipePantryMatch): string {
  if (match.missingCount === 0) {
    return RECIPES_COPY.recipeCard.haveEverything;
  }
  return RECIPES_COPY.recipeCard.needItems(match.missingCount);
}
