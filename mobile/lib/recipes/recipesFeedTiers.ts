import {
  DEFAULT_MIN_MATCHED_INGREDIENTS,
  DEFAULT_MIN_PANTRY_MATCH_PERCENT,
  RECIPES_TAB_CLOSE_MATCH_LIMIT,
  RECIPES_TAB_PARTIAL_MIN_MATCHED_COUNT,
} from '../../config/recipeMatching';
import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { filterRankedMatches, type RecipePantryMatch } from '../recipeMatch';

export interface RecipesFeedTierSplit {
  canMake: RecipePantryMatch[];
  close: RecipePantryMatch[];
}

export function isCanMakePantryMatch(
  match: RecipePantryMatch,
  minPercent = DEFAULT_MIN_PANTRY_MATCH_PERCENT,
): boolean {
  return (
    match.matchedCount >= DEFAULT_MIN_MATCHED_INGREDIENTS && match.percentMatch >= minPercent
  );
}

export function isClosePantryMatch(match: RecipePantryMatch, excludeRecipeIds: Set<string>): boolean {
  if (excludeRecipeIds.has(match.recipeId)) return false;
  if (match.matchedCount < RECIPES_TAB_PARTIAL_MIN_MATCHED_COUNT) return false;
  return match.missingCount >= 1 && match.missingCount <= 2;
}

/** Strict "can make" rows plus a small capped "close" band — no padding to a target count. */
export function splitRankedMatchesForRecipesTab(
  ranked: readonly RecipePantryMatch[],
  options?: { minPercent?: number; pantryItemCount?: number; closeLimit?: number },
): RecipesFeedTierSplit {
  const pantryItemCount = options?.pantryItemCount ?? ranked.length;
  if (pantryItemCount === 0) {
    return { canMake: [], close: [] };
  }

  const minPercent = options?.minPercent ?? DEFAULT_MIN_PANTRY_MATCH_PERCENT;
  const closeLimit = options?.closeLimit ?? RECIPES_TAB_CLOSE_MATCH_LIMIT;

  const pool = [...ranked];
  const canMake = filterRankedMatches(pool, 'all', minPercent, {
    minMatchedCount: DEFAULT_MIN_MATCHED_INGREDIENTS,
    pantryItemCount,
  });

  const canMakeIds = new Set(canMake.map((m) => m.recipeId));
  const close = filterRankedMatches(pool, 'missing_1_2', 0, {
    minMatchedCount: RECIPES_TAB_PARTIAL_MIN_MATCHED_COUNT,
    pantryItemCount,
  })
    .filter((m) => !canMakeIds.has(m.recipeId))
    .slice(0, closeLimit);

  return { canMake, close };
}

export function splitRecipesTabRowsByTier(
  rows: readonly RecipesTabRow[],
  minPercent = DEFAULT_MIN_PANTRY_MATCH_PERCENT,
  closeLimit = RECIPES_TAB_CLOSE_MATCH_LIMIT,
): { canMake: RecipesTabRow[]; close: RecipesTabRow[] } {
  const canMake: RecipesTabRow[] = [];
  const closeCandidates: RecipesTabRow[] = [];
  const canMakeIds = new Set<string>();

  for (const row of rows) {
    if (isCanMakePantryMatch(row.match, minPercent)) {
      canMake.push(row);
      canMakeIds.add(row.kind === 'kitchen' ? row.recipe.id : `recipeapi-${row.recipe.id}`);
    }
  }

  for (const row of rows) {
    const recipeId = row.kind === 'kitchen' ? row.recipe.id : `recipeapi-${row.recipe.id}`;
    if (canMakeIds.has(recipeId)) continue;
    if (isClosePantryMatch(row.match, canMakeIds)) {
      closeCandidates.push(row);
    }
  }

  closeCandidates.sort((a, b) => {
    if (b.match.matchedCount !== a.match.matchedCount) return b.match.matchedCount - a.match.matchedCount;
    if (b.match.percentMatch !== a.match.percentMatch) return b.match.percentMatch - a.match.percentMatch;
    return a.match.missingCount - b.match.missingCount;
  });

  return { canMake, close: closeCandidates.slice(0, closeLimit) };
}
