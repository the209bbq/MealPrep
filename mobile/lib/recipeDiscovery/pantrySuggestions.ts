import {
  DEFAULT_MIN_MATCHED_INGREDIENTS,
  DEFAULT_MIN_PANTRY_MATCH_PERCENT,
  PANTRY_DISCOVERY_PER_QUERY,
  RECIPE_MATCHING,
  RECIPES_TAB_PARTIAL_MATCH_LIMIT,
  RECIPES_TAB_PARTIAL_MIN_MATCHED_COUNT,
} from '../../config/recipeMatching';
import { filterRankedMatchesWithPartialFallback } from '../recipeMatch/match';
import { RECIPES_COPY } from '../../config/recipesCopy';
import { RECIPE_DISCOVERY } from '../../config/appConfig';
import type { PantryItem } from '../../types/mealprep';
import { searchDiscoveryRecipes } from './client';
import { buildRotatingPantrySearchPlans } from './pantryQueryPlans';
import { scoreDiscoveryRecipeAgainstPantry } from './scorePantry';
import { collapseNearDuplicateRecipeRows } from '../recipes/nearDuplicate';
import type { RecipesTabRow } from '../../config/recipesTabFilters';
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

function pantryCacheKey(pantry: PantryItem[], refreshSeed: number): string {
  return `${refreshSeed}:${pantry
    .map((p) => `${p.id}:${p.name}`)
    .sort()
    .join('|')}`;
}

function discoveryRowsFromSuggestions(rows: PantryDiscoverySuggestion[]): RecipesTabRow[] {
  return rows.map((row) => ({
    kind: 'discovery' as const,
    recipe: row.recipe,
    match: row.match,
  }));
}

function collapseDiscoveryNearDuplicates(rows: PantryDiscoverySuggestion[]): PantryDiscoverySuggestion[] {
  const asRows = discoveryRowsFromSuggestions(rows);
  const collapsed = collapseNearDuplicateRecipeRows(asRows);
  const byApiId = new Map(rows.map((row) => [row.recipe.id, row]));
  return collapsed
    .filter((row): row is Extract<RecipesTabRow, { kind: 'discovery' }> => row.kind === 'discovery')
    .map((row) => byApiId.get(row.recipe.id))
    .filter((row): row is PantryDiscoverySuggestion => row != null);
}

function rankSuggestions(rows: PantryDiscoverySuggestion[]): PantryDiscoverySuggestion[] {
  return rows
    .filter((row) => row.match.matchedCount >= RECIPES_TAB_PARTIAL_MIN_MATCHED_COUNT)
    .sort((a, b) => {
      if (b.match.matchedCount !== a.match.matchedCount) {
        return b.match.matchedCount - a.match.matchedCount;
      }
      if (b.match.percentMatch !== a.match.percentMatch) {
        return b.match.percentMatch - a.match.percentMatch;
      }
      return a.match.missingCount - b.match.missingCount;
    });
}

function filterDiscoveryByPantryOverlap(
  rows: PantryDiscoverySuggestion[],
  minPercent: number,
  pantryItemCount: number,
): PantryDiscoverySuggestion[] {
  if (rows.length === 0 || pantryItemCount === 0) return [];
  const { matches } = filterRankedMatchesWithPartialFallback(
    rows.map((row) => row.match),
    'all',
    minPercent,
    {
      minMatchedCount: DEFAULT_MIN_MATCHED_INGREDIENTS,
      pantryItemCount,
      partialMinMatchedCount: RECIPES_TAB_PARTIAL_MIN_MATCHED_COUNT,
      partialMatchMax: RECIPES_TAB_PARTIAL_MATCH_LIMIT,
    },
  );
  const byId = new Map(rows.map((row) => [row.match.recipeId, row]));
  return matches
    .map((m) => byId.get(m.recipeId))
    .filter((row): row is PantryDiscoverySuggestion => row != null);
}

export async function fetchPantryDiscoverySuggestions(
  pantry: PantryItem[],
  accessToken: string | null,
  options?: { minPercent?: number; forceRefresh?: boolean; refreshSeed?: number },
): Promise<PantryDiscoveryResult> {
  if (pantry.length === 0) {
    return { suggestions: [], errorMessage: null, fromCache: false };
  }

  const refreshSeed = options?.refreshSeed ?? 0;
  const cacheKey = pantryCacheKey(pantry, refreshSeed);
  if (!options?.forceRefresh) {
    const hit = suggestionCache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      return { ...hit.result, fromCache: true };
    }
  }

  const plans = buildRotatingPantrySearchPlans(pantry, { seed: refreshSeed });
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
          page: plan.page,
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

  const minPercent = options?.minPercent ?? DEFAULT_MIN_PANTRY_MATCH_PERCENT;
  const ranked = rankSuggestions(scored);
  const filtered = filterDiscoveryByPantryOverlap(ranked, minPercent, pantry.length);
  const deduped = collapseDiscoveryNearDuplicates(filtered);

  const errorMessage =
    failures === plans.length && deduped.length === 0
      ? accessToken
        ? RECIPES_COPY.discoveryErrors.pantrySuggestionsUnavailable
        : RECIPES_COPY.discoveryPanel.searchNotAvailableInBuild
      : null;

  const result: PantryDiscoveryResult = {
    suggestions: deduped.slice(0, RECIPE_MATCHING.homeRecommendationsLimit * 4),
    errorMessage,
    fromCache: false,
  };

  suggestionCache.set(cacheKey, { result, expiresAt: Date.now() + RECIPE_DISCOVERY.cacheTtlMs });
  return result;
}
