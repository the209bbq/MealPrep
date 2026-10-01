import { PANTRY_DISCOVERY_MAX_QUERIES } from '../../config/recipeMatching';
import { PANTRY_STAPLES } from '../recipeMatch/config';
import { canonicalIngredientSearchLabel, tokenizeIngredientName } from '../recipeMatch/normalize';
import type { PantryItem } from '../../types/mealprep';

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

  const candidates = pantry
    .filter((item) => !isPantryItemStapleLike(item))
    .sort((a, b) => b.name.trim().length - a.name.trim().length);

  for (const item of candidates) {
    const label = canonicalIngredientSearchLabel(item.name).toLowerCase();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    queries.push(label);
    if (queries.length >= maxQueries) break;
  }

  return queries;
}
