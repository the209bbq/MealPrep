import {
  DEFAULT_MIN_MATCHED_INGREDIENTS,
  DEFAULT_MIN_PANTRY_MATCH_PERCENT,
  PANTRY_DISCOVERY_PER_QUERY,
} from '../../config/recipeMatching';
import { RECIPE_DISCOVERY } from '../../config/appConfig';
import type { PantryItem } from '../../types/mealprep';
import { searchDiscoveryRecipes } from './client';
import { pantryIngredientSearchQueries } from './pantryQueries';
import { scoreDiscoveryRecipeAgainstPantry } from './scorePantry';
import type { RecipeDiscoveryListItem } from './types';

export interface PantryDiscoverySuggestion {
  recipe: RecipeDiscoveryListItem;
  match: ReturnType<typeof scoreDiscoveryRecipeAgainstPantry>;
}

interface PantrySuggestionsCacheEntry {
  suggestions: PantryDiscoverySuggestion[];
  expiresAt: number;
}

const pantrySuggestionsCache = new Map<string, PantrySuggestionsCacheEntry>();

/** Max RecipeAPI list page to randomize within (keeps free-tier usage predictable). */
const PANTRY_DISCOVERY_MAX_PAGE = 12;

function pantrySignature(pantry: PantryItem[]): string {
  return pantry
    .map((item) => `${item.id}:${item.name}`)
    .sort()
    .join('|');
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return hash;
}

function discoveryPageForQuery(pantry: PantryItem[], search: string, queryIndex: number): number {
  const bucket = Math.floor(Date.now() / RECIPE_DISCOVERY.cacheTtlMs);
  const seed = `${pantrySignature(pantry)}:${search}:${queryIndex}:${bucket}`;
  const page = 1 + (Math.abs(hashString(seed)) % PANTRY_DISCOVERY_MAX_PAGE);
  return page;
}

function buildPantrySearchPlans(pantry: PantryItem[]): { search: string; ingredients?: string }[] {
  const queries = pantryIngredientSearchQueries(pantry);
  if (queries.length === 0) return [];

  const plans: { search: string; ingredients?: string }[] = queries.map((search) => ({
    search,
    ingredients: search,
  }));

  if (queries.length >= 2) {
    const combined = queries.slice(0, 3).join(' ');
    if (combined.trim()) {
      plans.unshift({ search: combined, ingredients: combined });
    }
  }

  const seen = new Set<string>();
  return plans.filter((plan) => {
    const key = plan.search.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function fetchPantryDiscoverySuggestions(
  pantry: PantryItem[],
  accessToken: string | null,
): Promise<PantryDiscoverySuggestion[]> {
  if (pantry.length === 0) return [];

  const cacheKey = pantrySignature(pantry);
  const cached = pantrySuggestionsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.suggestions;
  }

  const plans = buildPantrySearchPlans(pantry);
  if (plans.length === 0) return [];

  const byId = new Map<number, RecipeDiscoveryListItem>();

  for (let queryIndex = 0; queryIndex < plans.length; queryIndex += 1) {
    const plan = plans[queryIndex];
    try {
      const result = await searchDiscoveryRecipes(
        {
          search: plan.search,
          ingredients: plan.ingredients,
          page: discoveryPageForQuery(pantry, plan.search, queryIndex),
          perPage: PANTRY_DISCOVERY_PER_QUERY,
        },
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

  pantrySuggestionsCache.set(cacheKey, {
    suggestions: ranked,
    expiresAt: Date.now() + RECIPE_DISCOVERY.cacheTtlMs,
  });

  return ranked;
}
