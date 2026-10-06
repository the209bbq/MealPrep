import { RECIPES_COPY } from '../../config/recipesCopy';
import type { RecipePantryMatch } from '../recipeMatch';
import { recipeMissingShopCount } from '../recipeMatch/missingShopCount';

/** One-line shop hint for recipe list cards (from precomputed pantry match). */
export function recipeListShopLine(match: RecipePantryMatch): string {
  const missing = recipeMissingShopCount(match);
  if (missing === 0) {
    return RECIPES_COPY.recipeCard.haveEverything;
  }
  return RECIPES_COPY.recipeCard.needItems(missing);
}
