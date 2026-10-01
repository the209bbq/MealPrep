/**
 * Recipe ↔ pantry matching defaults for the Recipes tab, home recommendations, and pantry discovery.
 */

import { filterRankedMatches, type RecipePantryMatch } from '../lib/recipeMatch';

export {
  FUZZY_MATCH_THRESHOLD,
  INGREDIENT_CATEGORY_GROUPS,
  INGREDIENT_STRIP_TOKENS,
  INGREDIENT_SYNONYMS,
  PANTRY_STAPLES,
} from './recipeMatchingConfig';

/** Default minimum match % chip on Recipes (0 = show best-ranked matches). */
export const DEFAULT_MIN_PANTRY_MATCH_PERCENT = 0;

/** Kitchen catalog list is ranked by match %; percent filter only applies when user raises the chip. */
export const KITCHEN_LIST_DEFAULT_MIN_PERCENT = 0;

/** Recipes must match at least this many pantry ingredients (non-staples) to appear. */
export const DEFAULT_MIN_MATCHED_INGREDIENTS = 2;

/** Max pantry ingredient names to use as RecipeAPI search queries per refresh. */
export const PANTRY_DISCOVERY_MAX_QUERIES = 5;

/** Recipes returned per pantry ingredient query (keep low for API quota). */
export const PANTRY_DISCOVERY_PER_QUERY = 6;

/** Grouped defaults for appConfig / home UX. */
export const RECIPE_MATCHING = {
  defaultMinPercent: DEFAULT_MIN_PANTRY_MATCH_PERCENT,
  defaultMinMatchedCount: DEFAULT_MIN_MATCHED_INGREDIENTS,
  homeRecommendationsLimit: 3,
} as const;

export function filterDefaultKitchenMatches(
  ranked: RecipePantryMatch[],
  pantryItemCount?: number,
): RecipePantryMatch[] {
  return filterRankedMatches(ranked, 'all', KITCHEN_LIST_DEFAULT_MIN_PERCENT, {
    minMatchedCount: DEFAULT_MIN_MATCHED_INGREDIENTS,
    pantryItemCount,
  });
}

export function countDefaultKitchenMatches(ranked: RecipePantryMatch[], pantryItemCount?: number): number {
  return filterDefaultKitchenMatches(ranked, pantryItemCount).length;
}

export function topDefaultKitchenMatch(
  ranked: RecipePantryMatch[],
  pantryItemCount?: number,
): RecipePantryMatch | undefined {
  return filterDefaultKitchenMatches(ranked, pantryItemCount)[0];
}
