import { DEFAULT_MIN_PANTRY_MATCH_PERCENT, PANTRY_DISCOVERY_PER_QUERY } from '../../config/recipeMatching';
import { splitRankedMatchesForRecipesTab } from '../recipes/recipesFeedTiers';
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
  closeSuggestions: PantryDiscoverySuggestion[];
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
    .filter((row) => row.match.matchedCount >= 1)
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

function tierDiscoveryByPantryOverlap(
  rows: PantryDiscoverySuggestion[],
  minPercent: number,
  pantryItemCount: number,
): { canMake: PantryDiscoverySuggestion[]; close: PantryDiscoverySuggestion[] } {
  if (rows.length === 0 || pantryItemCount === 0) {
    return { canMake: [], close: [] };
  }
  const { canMake, close } = splitRankedMatchesForRecipesTab(
    rows.map((row) => row.match),
    { minPercent, pantryItemCount },
  );
  const byId = new Map(rows.map((row) => [row.match.recipeId, row]));
  const mapTier = (matches: typeof canMake) =>
    matches
      .map((m) => byId.get(m.recipeId))
      .filter((row): row is PantryDiscoverySuggestion => row != null);
  return { canMake: mapTier(canMake), close: mapTier(close) };
}

export async function fetchPantryDiscoverySuggestions(
  pantry: PantryItem[],
  accessToken: string | null,
  options?: { minPercent?: number; forceRefresh?: boolean; refreshSeed?: number },
): Promise<PantryDiscoveryResult> {
  if (pantry.length === 0) {
    return { suggestions: [], closeSuggestions: [], errorMessage: null, fromCache: false };
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
    const empty: PantryDiscoveryResult = {
      suggestions: [],
      closeSuggestions: [],
      errorMessage: null,
      fromCache: false,
    };
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
  const tiered = tierDiscoveryByPantryOverlap(ranked, minPercent, pantry.length);
  const dedupedCanMake = collapseDiscoveryNearDuplicates(tiered.canMake);
  const dedupedClose = collapseDiscoveryNearDuplicates(tiered.close);

  const errorMessage =
    failures === plans.length && dedupedCanMake.length === 0 && dedupedClose.length === 0
      ? accessToken
        ? RECIPES_COPY.discoveryErrors.pantrySuggestionsUnavailable
        : RECIPES_COPY.discoveryPanel.searchNotAvailableInBuild
      : null;

  const result: PantryDiscoveryResult = {
    suggestions: dedupedCanMake,
    closeSuggestions: dedupedClose,
    errorMessage,
    fromCache: false,
  };

  suggestionCache.set(cacheKey, { result, expiresAt: Date.now() + RECIPE_DISCOVERY.cacheTtlMs });
  return result;
}
