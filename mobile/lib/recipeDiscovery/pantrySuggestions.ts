import { PANTRY_DISCOVERY_PER_QUERY } from '../../config/recipeMatching';
import { RECIPES_COPY } from '../../config/recipesCopy';
import { RECIPE_DISCOVERY } from '../../config/appConfig';
import type { PantryItem } from '../../types/mealprep';
import { buildBrowseDiscoverySearchPlans } from './browseQueryPlans';
import { searchDiscoveryRecipes } from './client';
import { buildRotatingPantrySearchPlans, type PantryDiscoverySearchPlan } from './pantryQueryPlans';
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
  return [...rows].sort((a, b) => {
    if (b.match.matchedCount !== a.match.matchedCount) {
      return b.match.matchedCount - a.match.matchedCount;
    }
    if (b.match.percentMatch !== a.match.percentMatch) {
      return b.match.percentMatch - a.match.percentMatch;
    }
    return a.match.missingCount - b.match.missingCount;
  });
}

export async function fetchPantryDiscoverySuggestions(
  pantry: PantryItem[],
  accessToken: string | null,
  options?: { minPercent?: number; forceRefresh?: boolean; refreshSeed?: number },
): Promise<PantryDiscoveryResult> {
  const refreshSeed = options?.refreshSeed ?? 0;
  const cacheKey = pantry.length === 0 ? `browse:${refreshSeed}` : pantryCacheKey(pantry, refreshSeed);
  if (!options?.forceRefresh) {
    const hit = suggestionCache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      return { ...hit.result, fromCache: true };
    }
  }

  const plans: PantryDiscoverySearchPlan[] =
    pantry.length === 0
      ? buildBrowseDiscoverySearchPlans(refreshSeed)
      : buildRotatingPantrySearchPlans(pantry, { seed: refreshSeed });
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

  const ranked = rankSuggestions(scored);
  const deduped = collapseDiscoveryNearDuplicates(ranked);

  const errorMessage =
    failures === plans.length && deduped.length === 0
      ? accessToken
        ? RECIPES_COPY.discoveryErrors.pantrySuggestionsUnavailable
        : RECIPES_COPY.discoveryPanel.searchNotAvailableInBuild
      : null;

  const result: PantryDiscoveryResult = {
    suggestions: deduped,
    errorMessage,
    fromCache: false,
  };

  suggestionCache.set(cacheKey, { result, expiresAt: Date.now() + RECIPE_DISCOVERY.cacheTtlMs });
  return result;
}
