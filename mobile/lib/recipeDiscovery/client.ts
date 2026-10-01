import {
  getRecipeApiProxyUrl,
  isDemoMode,
  RECIPE_DISCOVERY,
} from '../../config/appConfig';
import { filterDemoRecipes, getDemoRecipeById } from './demoSamples';
import type {
  RecipeApiDetailResponse,
  RecipeApiErrorEnvelope,
  RecipeApiListResponse,
  RecipeDiscoverySearchFilters,
  RecipeDiscoveryListItem,
} from './types';

export class RecipeDiscoveryNotConfiguredError extends Error {
  code = 'NOT_CONFIGURED';
  constructor(message: string) {
    super(message);
    this.name = 'RecipeDiscoveryNotConfiguredError';
  }
}

export class RecipeDiscoveryAuthError extends Error {
  code = 'UNAUTHENTICATED';
}

interface MemoryCacheEntry {
  payload: unknown;
  expiresAt: number;
}

const memoryCache = new Map<string, MemoryCacheEntry>();

function cacheGet<T>(key: string): T | null {
  const hit = memoryCache.get(key);
  if (!hit || hit.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return hit.payload as T;
}

function cacheSet(key: string, payload: unknown): void {
  memoryCache.set(key, { payload, expiresAt: Date.now() + RECIPE_DISCOVERY.cacheTtlMs });
}

function filtersToQuery(filters: RecipeDiscoverySearchFilters): Record<string, string | number> {
  const query: Record<string, string | number> = {
    per_page: filters.perPage ?? RECIPE_DISCOVERY.defaultPerPage,
    page: filters.page ?? 1,
  };
  if (filters.search?.trim()) query.search = filters.search.trim();
  if (filters.ingredients?.trim()) query.ingredients = filters.ingredients.trim();
  if (filters.cuisine) query.cuisine = filters.cuisine;
  if (filters.mealType) query.meal_type = filters.mealType;
  if (filters.difficulty) query.difficulty = filters.difficulty;
  if (filters.dietaryTag) query.dietary_tags = filters.dietaryTag;
  if (filters.maxTotalMinutes != null && filters.maxTotalMinutes > 0) {
    query.prep_time_max = filters.maxTotalMinutes;
    query.cook_time_max = filters.maxTotalMinutes;
  }
  return query;
}

async function callProxy<T>(
  body: Record<string, unknown>,
  accessToken: string | null,
): Promise<T> {
  const url = getRecipeApiProxyUrl();
  if (!url) {
    throw new RecipeDiscoveryNotConfiguredError(
      'Recipe search isn’t set up on this app yet. Ask an admin to connect it.',
    );
  }
  if (!accessToken) {
    throw new RecipeDiscoveryAuthError('Sign in to search recipes.');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let json: T & RecipeApiErrorEnvelope & { error?: string; code?: string };
  try {
    json = JSON.parse(text) as T & RecipeApiErrorEnvelope & { error?: string; code?: string };
  } catch {
    throw new Error('Unexpected response from recipe proxy');
  }

  if (response.status === 503 && (json.code === 'NOT_CONFIGURED' || json.error?.includes('not set up'))) {
    throw new RecipeDiscoveryNotConfiguredError(json.error ?? 'Recipe discovery is not configured on the server.');
  }
  if (response.status === 401) {
    throw new RecipeDiscoveryAuthError(json.error ?? 'Sign in required');
  }
  if (!response.ok) {
    const errField = json.error;
    const apiMsg =
      typeof errField === 'object' && errField && 'message' in errField
        ? String((errField as { message?: string }).message)
        : typeof errField === 'string'
          ? errField
          : undefined;
    throw new Error(apiMsg ?? `Recipe search failed (${response.status})`);
  }

  return json;
}

export async function searchDiscoveryRecipes(
  filters: RecipeDiscoverySearchFilters,
  accessToken: string | null,
): Promise<{ items: RecipeDiscoveryListItem[]; meta: RecipeApiListResponse['meta'] | null }> {
  if (isDemoMode()) {
    const items = filterDemoRecipes(filters.search ?? '', {
      cuisine: filters.cuisine,
      difficulty: filters.difficulty,
    });
    return {
      items,
      meta: {
        current_page: 1,
        last_page: 1,
        path: 'demo',
        per_page: items.length,
        total: items.length,
        language: 'en',
      },
    };
  }

  const query = filtersToQuery(filters);
  const cacheKey = `list:${JSON.stringify(query)}`;
  const cached = cacheGet<RecipeApiListResponse>(cacheKey);
  if (cached) {
    return { items: cached.data, meta: cached.meta };
  }

  const payload = await callProxy<RecipeApiListResponse>({ action: 'list', query }, accessToken);
  cacheSet(cacheKey, payload);
  return { items: payload.data, meta: payload.meta };
}

export async function fetchDiscoveryRecipeDetail(
  id: number,
  accessToken: string | null,
): Promise<RecipeDiscoveryListItem> {
  if (isDemoMode()) {
    const demo = getDemoRecipeById(id);
    if (!demo) throw new Error('Demo recipe not found');
    return demo;
  }

  const cacheKey = `detail:${id}`;
  const cached = cacheGet<RecipeApiDetailResponse>(cacheKey);
  if (cached) return cached.data;

  const payload = await callProxy<RecipeApiDetailResponse>({ action: 'detail', id }, accessToken);
  cacheSet(cacheKey, payload);
  return payload.data;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function debouncedSearch(
  filters: RecipeDiscoverySearchFilters,
  accessToken: string | null,
  onResult: (result: Awaited<ReturnType<typeof searchDiscoveryRecipes>>) => void,
  onError: (error: Error) => void,
): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void searchDiscoveryRecipes(filters, accessToken)
      .then(onResult)
      .catch((err: unknown) => onError(err instanceof Error ? err : new Error(String(err))));
  }, RECIPE_DISCOVERY.searchDebounceMs);
}
