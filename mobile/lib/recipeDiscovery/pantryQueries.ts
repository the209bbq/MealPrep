import { PANTRY_STAPLES } from '../recipeMatch/config';
import { normalizeIngredientName, tokenizeIngredientName } from '../recipeMatch/normalize';
import type { PantryItem } from '../../types/mealprep';
import { PANTRY_DISCOVERY_MAX_QUERIES } from '../../config/recipeMatching';

const STAPLE_TOKEN_SET = new Set(
  PANTRY_STAPLES.flatMap((s) => tokenizeIngredientName(s)),
);

function isPantryItemStapleLike(item: PantryItem): boolean {
  const tokens = tokenizeIngredientName(item.name);
  if (tokens.length === 0) return true;
  return tokens.every((t) => STAPLE_TOKEN_SET.has(t));
}

/** Distinct search phrases from pantry names for RecipeAPI list queries. */
export function pantryIngredientSearchQueries(
  pantry: PantryItem[],
  maxQueries = PANTRY_DISCOVERY_MAX_QUERIES,
): string[] {
  const seen = new Set<string>();
  const queries: string[] = [];

  for (const item of pantry) {
    if (isPantryItemStapleLike(item)) continue;
    const normalized = normalizeIngredientName(item.name);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    queries.push(item.name.trim());
    if (queries.length >= maxQueries) break;
  }

  return queries;
}
