import { PANTRY_DISCOVERY_PER_QUERY } from '../../config/recipeMatching';
import { RECIPES_COPY } from '../../config/recipesCopy';
import { RECIPE_DISCOVERY } from '../../config/appConfig';
import { RECIPE_SOURCES } from '../../config/recipeSources';
import { RECIPE_DISCOVERY_ONLINE_UNAVAILABLE_NOTE } from '../../config/recipeDiscoveryClient';
import { isRecipeDiscoveryCircuitOpen } from './circuitBreaker';
import type { PantryItem } from '../../types/mealprep';
import { buildBrowseDiscoverySearchPlans } from './browseQueryPlans';
import {
  RecipeDiscoveryQuotaError,
  searchDiscoveryRecipes,
} from './client';
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

const DISCOVERY_SCORE_CHUNK_SIZE = 8;

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

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function scoreDiscoverySuggestionsChunked(
  recipes: RecipeDiscoveryListItem[],
  pantry: PantryItem[],
  onPartial?: (partial: PantryDiscoverySuggestion[]) => void,
): Promise<PantryDiscoverySuggestion[]> {
  const scored: PantryDiscoverySuggestion[] = [];
  for (let index = 0; index < recipes.length; index += DISCOVERY_SCORE_CHUNK_SIZE) {
    const slice = recipes.slice(index, index + DISCOVERY_SCORE_CHUNK_SIZE);
    for (const recipe of slice) {
      scored.push({
        recipe,
        match: scoreDiscoveryRecipeAgainstPantry(recipe, pantry),
      });
    }
    onPartial?.(rankSuggestions([...scored]));
    if (index + DISCOVERY_SCORE_CHUNK_SIZE < recipes.length) {
      await yieldToMain();
    }
  }
  return scored;
}

async function fetchDiscoveryListItems(
  plans: PantryDiscoverySearchPlan[],
  accessToken: string | null,
): Promise<{ items: RecipeDiscoveryListItem[]; quotaExceeded: boolean; failures: number }> {
  if (isRecipeDiscoveryCircuitOpen()) {
    return { items: [], quotaExceeded: true, failures: plans.length };
  }

  const byId = new Map<number, RecipeDiscoveryListItem>();
  let failures = 0;
  let quotaExceeded = false;

  const results = await Promise.allSettled(
    plans.map((plan) =>
      searchDiscoveryRecipes(
        {
          search: plan.search,
          ingredients: plan.ingredients,
          page: plan.page,
          perPage: PANTRY_DISCOVERY_PER_QUERY,
        },
        accessToken,
      ),
    ),
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const item of result.value.items) {
        if (!byId.has(item.id)) byId.set(item.id, item);
      }
      continue;
    }
    failures += 1;
    if (result.reason instanceof RecipeDiscoveryQuotaError) {
      quotaExceeded = true;
      break;
    }
  }

  return { items: [...byId.values()], quotaExceeded, failures };
}

export async function fetchPantryDiscoverySuggestions(
  pantry: PantryItem[],
  accessToken: string | null,
  options?: {
    minPercent?: number;
    forceRefresh?: boolean;
    refreshSeed?: number;
    onPartial?: (partial: PantryDiscoverySuggestion[]) => void;
  },
): Promise<PantryDiscoveryResult> {
  if (!RECIPE_SOURCES.recipeApiEnabled || !RECIPE_DISCOVERY.enabled) {
    return { suggestions: [], errorMessage: null, fromCache: false };
  }

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

  const { items, quotaExceeded, failures } = await fetchDiscoveryListItems(plans, accessToken);

  const scored = await scoreDiscoverySuggestionsChunked(items, pantry, options?.onPartial);
  const ranked = rankSuggestions(scored);
  const deduped = collapseDiscoveryNearDuplicates(ranked);

  let errorMessage: string | null = null;
  if (quotaExceeded) {
    errorMessage = RECIPE_DISCOVERY_ONLINE_UNAVAILABLE_NOTE;
  } else if (failures === plans.length && deduped.length === 0) {
    errorMessage = accessToken
      ? RECIPES_COPY.discoveryErrors.pantrySuggestionsUnavailable
      : RECIPES_COPY.discoveryPanel.searchNotAvailableInBuild;
  }

  const result: PantryDiscoveryResult = {
    suggestions: deduped,
    errorMessage,
    fromCache: false,
  };

  suggestionCache.set(cacheKey, { result, expiresAt: Date.now() + RECIPE_DISCOVERY.cacheTtlMs });
  return result;
}
