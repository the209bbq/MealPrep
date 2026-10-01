import {
  DEFAULT_MIN_MATCHED_INGREDIENTS,
  DEFAULT_MIN_PANTRY_MATCH_PERCENT,
} from '../../config/recipeMatching';
import {
  filterRankedMatches,
  type RecipePantryFilterMode,
} from '../recipeMatch';
import type { PantryDiscoverySuggestion } from './pantrySuggestions';

export function filterPantryDiscoverySuggestions(
  suggestions: PantryDiscoverySuggestion[],
  mode: RecipePantryFilterMode,
  minPercent: number,
  pantryItemCount: number,
): PantryDiscoverySuggestion[] {
  if (pantryItemCount === 0 || suggestions.length === 0) return [];

  const ranked = suggestions.map((row) => row.match);
  const allowedIds = new Set(
    filterRankedMatches(ranked, mode === 'best_match' ? 'all' : mode, minPercent, {
      minMatchedCount: DEFAULT_MIN_MATCHED_INGREDIENTS,
      pantryItemCount,
    }).map((match) => match.recipeId),
  );

  return suggestions.filter((row) => allowedIds.has(row.match.recipeId));
}

export function splitDiscoveryCookNowLists(
  suggestions: PantryDiscoverySuggestion[],
  mode: RecipePantryFilterMode,
  minPercent: number,
  pantryItemCount: number,
): { cookNow: PantryDiscoverySuggestion[]; needItems: PantryDiscoverySuggestion[] } {
  const filtered = filterPantryDiscoverySuggestions(suggestions, mode, minPercent, pantryItemCount);
  return {
    cookNow: filtered.filter((row) => row.match.missingCount === 0),
    needItems: filtered.filter((row) => row.match.missingCount > 0),
  };
}

export const PANTRY_DISCOVERY_COOK_NOW_DEFAULT_MIN_PERCENT = DEFAULT_MIN_PANTRY_MATCH_PERCENT;
