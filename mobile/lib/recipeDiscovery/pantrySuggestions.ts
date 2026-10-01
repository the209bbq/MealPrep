import {
  DEFAULT_MIN_MATCHED_INGREDIENTS,
  PANTRY_DISCOVERY_PER_QUERY,
  RECIPE_MATCHING,
} from '../../config/recipeMatching';
import { RECIPES_COPY } from '../../config/recipesCopy';
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

export interface PantryDiscoveryResult {
  suggestions: PantryDiscoverySuggestion[];
  /** Set when every query failed (network/auth/proxy). */
  errorMessage: string | null;
  fromCache: boolean;
}

interface CacheEntry {
  result: PantryDiscoveryResult;
  expiresAt: number;
}

const suggestionCache = new Map<string, CacheEntry>();

/** Max RecipeAPI list page to randomize within (keeps free-tier usage predictable). */
const PANTRY_DISCOVERY_MAX_PAGE = 12;

function pantryCacheKey(pantry: PantryItem[]): string {
  return pantry
    .map((p) => `${p.id}:${p.name}`)
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
  const seed = `${pantryCacheKey(pantry)}:${search}:${queryIndex}:${bucket}`;
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

function rankSuggestions(rows: PantryDiscoverySuggestion[]): PantryDiscoverySuggestion[] {
  return rows
    .filter((row) => row.match.matchedCount >= DEFAULT_MIN_MATCHED_INGREDIENTS)
    .sort((a, b) => {
      if (b.match.percentMatch !== a.match.percentMatch) {
        return b.match.percentMatch - a.match.percentMatch;
      }
      if (b.match.matchedCount !== a.match.matchedCount) {
        return b.match.matchedCount - a.match.matchedCount;
      }
      return a.match.missingCount - b.match.missingCount;
    });
}

export async function fetchPantryDiscoverySuggestions(
  pantry: PantryItem[],
  accessToken: string | null,
  options?: { minPercent?: number; forceRefresh?: boolean },
): Promise<PantryDiscoveryResult> {
  if (pantry.length === 0) {
    return { suggestions: [], errorMessage: null, fromCache: false };
  }

  const cacheKey = pantryCacheKey(pantry);
  if (!options?.forceRefresh) {
    const hit = suggestionCache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      return { ...hit.result, fromCache: true };
    }
  }

  const plans = buildPantrySearchPlans(pantry);
  if (plans.length === 0) {
    const empty: PantryDiscoveryResult = { suggestions: [], errorMessage: null, fromCache: false };
    suggestionCache.set(cacheKey, { result: empty, expiresAt: Date.now() + RECIPE_DISCOVERY.cacheTtlMs });
    return empty;
  }

  const byId = new Map<number, RecipeDiscoveryListItem>();
  let failures = 0;

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
      failures += 1;
    }
  }

  const scored = [...byId.values()].map((recipe) => ({
    recipe,
    match: scoreDiscoveryRecipeAgainstPantry(recipe, pantry),
  }));

  const minPercent = options?.minPercent ?? 0;
  const ranked = rankSuggestions(scored).filter((row) => row.match.percentMatch >= minPercent);

  const errorMessage =
    failures === plans.length && ranked.length === 0
      ? accessToken
        ? RECIPES_COPY.discoveryErrors.pantrySuggestionsUnavailable
        : RECIPES_COPY.discoveryPanel.searchNotAvailableInBuild
      : null;

  const result: PantryDiscoveryResult = {
    suggestions: ranked.slice(0, RECIPE_MATCHING.homeRecommendationsLimit * 4),
    errorMessage,
    fromCache: false,
  };

  suggestionCache.set(cacheKey, { result, expiresAt: Date.now() + RECIPE_DISCOVERY.cacheTtlMs });
  return result;
}
