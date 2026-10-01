import { filterRankedMatches, type RecipePantryMatch } from '../lib/recipeMatch';

/** Defaults for pantry-ranked kitchen recipes (save time by surfacing cookable meals). */
export const RECIPE_MATCHING = {
  /** Hide weak matches unless user loosens filters. */
  defaultMinPercent: 50,
  /** Require at least this many ingredient matches (non-staple). */
  defaultMinMatchedCount: 2,
  /** Home “Cook from pantry” short list length. */
  homeRecommendationsLimit: 3,
} as const;

export function filterDefaultKitchenMatches(ranked: RecipePantryMatch[]): RecipePantryMatch[] {
  return filterRankedMatches(ranked, 'all', RECIPE_MATCHING.defaultMinPercent, {
    minMatchedCount: RECIPE_MATCHING.defaultMinMatchedCount,
  });
}

export function countDefaultKitchenMatches(ranked: RecipePantryMatch[]): number {
  return filterDefaultKitchenMatches(ranked).length;
}

export function topDefaultKitchenMatch(ranked: RecipePantryMatch[]): RecipePantryMatch | undefined {
  return filterDefaultKitchenMatches(ranked)[0];
}
