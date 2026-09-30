import {
  DEFAULT_MIN_MATCHED_INGREDIENTS,
  DEFAULT_MIN_PANTRY_MATCH_PERCENT,
  PANTRY_DISCOVERY_PER_QUERY,
} from '../../config/recipeMatching';
import type { PantryItem } from '../../types/mealprep';
import { searchDiscoveryRecipes } from './client';
import { pantryIngredientSearchQueries } from './pantryQueries';
import { scoreDiscoveryRecipeAgainstPantry } from './scorePantry';
import type { RecipeDiscoveryListItem } from './types';

export interface PantryDiscoverySuggestion {
  recipe: RecipeDiscoveryListItem;
  match: ReturnType<typeof scoreDiscoveryRecipeAgainstPantry>;
}

export async function fetchPantryDiscoverySuggestions(
  pantry: PantryItem[],
  accessToken: string | null,
): Promise<PantryDiscoverySuggestion[]> {
  if (pantry.length === 0) return [];

  const queries = pantryIngredientSearchQueries(pantry);
  if (queries.length === 0) return [];

  const byId = new Map<number, RecipeDiscoveryListItem>();

  for (const search of queries) {
    try {
      const result = await searchDiscoveryRecipes(
        { search, page: 1, perPage: PANTRY_DISCOVERY_PER_QUERY },
        accessToken,
      );
      for (const item of result.items) {
        if (!byId.has(item.id)) byId.set(item.id, item);
      }
    } catch {
      // Skip failed query; other pantry terms may still return results.
    }
  }

  const scored = [...byId.values()].map((recipe) => ({
    recipe,
    match: scoreDiscoveryRecipeAgainstPantry(recipe, pantry),
  }));

  const ranked = scored
    .filter(
      (row) =>
        row.match.matchedCount >= DEFAULT_MIN_MATCHED_INGREDIENTS &&
        row.match.percentMatch >= DEFAULT_MIN_PANTRY_MATCH_PERCENT,
    )
    .sort((a, b) => {
      if (b.match.percentMatch !== a.match.percentMatch) {
        return b.match.percentMatch - a.match.percentMatch;
      }
      return a.match.missingCount - b.match.missingCount;
    });

  return ranked;
}
