import {
  getRecipeApiProxyUrl,
  isDemoMode,
  RECIPE_DISCOVERY,
} from '../../config/appConfig';
import {
  RECIPE_DISCOVERY_CLIENT_CACHE_KEY_PREFIX,
  RECIPE_DISCOVERY_CLIENT_CACHE_TTL_MS,
  RECIPE_DISCOVERY_CLIENT_FAILURE_CACHE_TTL_MS,
  RECIPE_DISCOVERY_QUOTA_ERROR_CODES,
} from '../../config/recipeDiscoveryClient';
import { readJson, writeJson } from '../storage';
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

export class RecipeDiscoveryQuotaError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'RecipeDiscoveryQuotaError';
    this.code = code;
  }
}

interface MemoryCacheEntry {
  payload: unknown;
  expiresAt: number;
  failed?: boolean;
}

const memoryCache = new Map<string, MemoryCacheEntry>();

interface PersistedCacheEntry {
  payload?: unknown;
  expiresAt: number;
  failed?: boolean;
}

function persistentCacheKey(key: string): string {
  return `${RECIPE_DISCOVERY_CLIENT_CACHE_KEY_PREFIX}:${key}`;
}

function readCacheEntry(key: string): MemoryCacheEntry | null {
  const hit = memoryCache.get(key);
  if (hit) {
    if (hit.expiresAt < Date.now()) {
      memoryCache.delete(key);
    } else {
      return hit;
    }
  }

  const persisted = readJson<PersistedCacheEntry | null>(persistentCacheKey(key), null);
  if (!persisted || persisted.expiresAt < Date.now()) {
    return null;
  }
  const entry: MemoryCacheEntry = {
    payload: persisted.payload,
    expiresAt: persisted.expiresAt,
    failed: persisted.failed,
  };
  memoryCache.set(key, entry);
  return entry;
}

function cacheGet<T>(key: string): T | null {
  const entry = readCacheEntry(key);
  if (!entry || entry.failed) return null;
  return entry.payload as T;
}

function cacheHasFailure(key: string): boolean {
  const entry = readCacheEntry(key);
  return entry?.failed === true;
}

function cacheSet(key: string, payload: unknown, failed = false): void {
  const ttl = failed ? RECIPE_DISCOVERY_CLIENT_FAILURE_CACHE_TTL_MS : RECIPE_DISCOVERY_CLIENT_CACHE_TTL_MS;
  const expiresAt = Date.now() + ttl;
  memoryCache.set(key, { payload, expiresAt, failed });
  writeJson(persistentCacheKey(key), { payload: failed ? null : payload, expiresAt, failed });
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

function isQuotaResponse(status: number, json: RecipeApiErrorEnvelope & { code?: string; error?: string }): boolean {
  if (status === 429) return true;
  const code = json.code ?? (typeof json.error === 'object' && json.error && 'code' in json.error
    ? String((json.error as { code?: string }).code)
    : undefined);
  if (code != null && RECIPE_DISCOVERY_QUOTA_ERROR_CODES.has(code)) return true;
  const message =
    typeof json.error === 'string'
      ? json.error
      : typeof json.error === 'object' && json.error && 'message' in json.error
        ? String((json.error as { message?: string }).message)
        : '';
  return /USAGE_LIMIT_EXCEEDED/i.test(message);
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
    throw new RecipeDiscoveryAuthError('Recipe search is not available in this build.');
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
  if (isQuotaResponse(response.status, json)) {
    const code = json.code ?? 'RATE_LIMIT';
    throw new RecipeDiscoveryQuotaError(json.error ?? 'Recipe search quota exceeded', code);
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
  if (cacheHasFailure(cacheKey)) {
    throw new Error('Recent recipe search failed');
  }
  const cached = cacheGet<RecipeApiListResponse>(cacheKey);
  if (cached) {
    return { items: cached.data, meta: cached.meta };
  }

  try {
    const payload = await callProxy<RecipeApiListResponse>({ action: 'list', query }, accessToken);
    cacheSet(cacheKey, payload, false);
    return { items: payload.data, meta: payload.meta };
  } catch (error) {
    if (!(error instanceof RecipeDiscoveryNotConfiguredError || error instanceof RecipeDiscoveryAuthError)) {
      cacheSet(cacheKey, null, true);
    }
    throw error;
  }
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
  cacheSet(cacheKey, payload, false);
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
