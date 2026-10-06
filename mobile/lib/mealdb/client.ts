import { MEALDB, mealDbApiBaseUrl } from '../../config/mealdb';
import { mapWithConcurrency } from '../concurrency';
import { listStorageKeysWithPrefix, readJson, removeStorageKey, writeJson } from '../storage';
import { notifyMealDbKitchenCacheChanged } from './kitchenCacheNotify';
import {
  fetchMealDbLookupWithRetries,
  MEALDB_LOOKUP_SLOT_TIMEOUT_MS,
  type MealDbLookupFetchOptions,
  type MealDbLookupPriority,
  resetMealDbLookupSchedulerForTests,
  withMealDbLookupSlotTimeout,
} from './lookupScheduler';
import { mealDbMealToAppRecipe } from './normalize';
import { mealDbIdFromRecipeId } from './slug';
import type { Recipe } from '../../types/mealprep';
import type {
  MealDbFilterMealSummary,
  MealDbFilterResponse,
  MealDbMealDetail,
  MealDbMealsResponse,
} from './types';

interface CacheEntry {
  payload: unknown;
  expiresAt: number;
  cachedAtMs?: number;
  failed?: boolean;
}

const memoryCache = new Map<string, CacheEntry>();

interface InFlightEntry {
  promise: Promise<unknown>;
  generation: number;
}

const inFlight = new Map<string, InFlightEntry>();
let inFlightGeneration = 0;

function persistentKey(key: string): string {
  return `${MEALDB.cacheKeyPrefix}:${key}`;
}

function readCacheEntry(key: string): CacheEntry | null {
  const hit = memoryCache.get(key);
  if (hit) return hit;
  const persisted = readJson<CacheEntry | null>(persistentKey(key), null);
  if (!persisted) return null;
  memoryCache.set(key, persisted);
  return persisted;
}

function writeCache(key: string, payload: unknown, ttlMs: number, failed = false): void {
  const now = Date.now();
  const entry: CacheEntry = {
    payload,
    expiresAt: now + ttlMs,
    cachedAtMs: now,
    failed,
  };
  memoryCache.set(key, entry);
  writeJson(persistentKey(key), entry);
  if (key.startsWith('lookup.php')) {
    notifyMealDbKitchenCacheChanged();
  }
}

function cacheEntryAgeMs(entry: CacheEntry, path: string): number {
  const cachedAt = entry.cachedAtMs ?? entry.expiresAt - cacheTtlMsForPath(path);
  return Date.now() - cachedAt;
}

function shouldStaleRevalidate(entry: CacheEntry, path: string): boolean {
  if (entry.failed) return false;
  return cacheEntryAgeMs(entry, path) >= MEALDB.staleRevalidateAfterMs;
}

function cacheFresh(entry: CacheEntry): boolean {
  return entry.expiresAt >= Date.now();
}

function cacheTtlMsForPath(path: string): number {
  if (path.startsWith('lookup.php')) return MEALDB.lookupCacheTtlMs;
  return MEALDB.filterCacheTtlMs;
}

async function fetchMealDbPath<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  const cacheKey = path;
  const url = `${mealDbApiBaseUrl()}${path}`;
  const controller = new AbortController();
  const timeoutMs = path.startsWith('lookup.php')
    ? MEALDB_LOOKUP_SLOT_TIMEOUT_MS
    : MEALDB.requestTimeoutMs;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  try {
    const response = await withMealDbLookupSlotTimeout(
      fetch(url, { signal: controller.signal }),
      timeoutMs,
      signal,
    );
    if (!response.ok) {
      return null;
    }
    const json = (await response.json()) as T;
    writeCache(cacheKey, json, cacheTtlMsForPath(path));
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function dropFailedCacheEntry(cacheKey: string): void {
  memoryCache.delete(cacheKey);
  inFlight.delete(cacheKey);
  removeStorageKey(persistentKey(cacheKey));
}

function dropInFlightEntry(cacheKey: string): void {
  inFlight.delete(cacheKey);
}

async function mealDbFetch<T>(path: string): Promise<T | null> {
  const cacheKey = path;
  const cached = readCacheEntry(cacheKey);
  if (cached) {
    if (cached.failed) {
      dropFailedCacheEntry(cacheKey);
    } else if (cacheFresh(cached)) {
      if (shouldStaleRevalidate(cached, path)) {
        void revalidateMealDbFetch<T>(path, 'background');
      }
      return cached.payload as T;
    } else {
      void revalidateMealDbFetch<T>(path, 'background');
      return cached.payload as T;
    }
  }
  return revalidateMealDbFetch<T>(path, 'background');
}

async function revalidateMealDbFetch<T>(
  path: string,
  priority: MealDbLookupPriority = 'background',
  options?: MealDbLookupFetchOptions,
): Promise<T | null> {
  const cacheKey = path;
  const signal = options?.signal;
  if (signal?.aborted) return null;

  const existing = inFlight.get(cacheKey);
  if (existing && !signal) {
    return existing.promise as Promise<T | null>;
  }

  const generation = ++inFlightGeneration;
  const promise = (path.startsWith('lookup.php')
    ? fetchMealDbLookupWithRetries<T>(
        priority,
        () => {
          if (signal?.aborted) return Promise.resolve(null);
          return fetchMealDbPath<T>(path, signal);
        },
        { signal },
      )
    : fetchMealDbPath<T>(path)
  )
    .catch((error: unknown) => {
      if (signal?.aborted) return null;
      throw error;
    })
    .finally(() => {
      const entry = inFlight.get(cacheKey);
      if (entry?.generation === generation) {
        dropInFlightEntry(cacheKey);
      }
    });

  inFlight.set(cacheKey, { promise, generation });
  return promise as Promise<T | null>;
}

function encodeFilterIngredient(name: string): string {
  return encodeURIComponent(name.trim().toLowerCase().replace(/\s+/g, '_'));
}

export async function mealDbFilterByIngredient(ingredient: string): Promise<string[]> {
  const path = `filter.php?i=${encodeFilterIngredient(ingredient)}`;
  const data = await mealDbFetch<MealDbFilterResponse>(path);
  if (!data?.meals) return [];
  return data.meals.map((row) => row.idMeal);
}

export async function mealDbFilterByCategory(category: string): Promise<string[]> {
  const summaries = await mealDbFilterSummariesByCategory(category);
  if (!summaries) return [];
  return summaries.map((row) => row.idMeal);
}

export async function mealDbFilterSummariesByCategory(
  category: string,
): Promise<MealDbFilterMealSummary[] | null> {
  const path = `filter.php?c=${encodeURIComponent(category.trim())}`;
  const data = await mealDbFetch<MealDbFilterResponse>(path);
  if (data === null) return null;
  if (!data.meals) return [];
  return data.meals;
}

interface MealDbCategoriesResponse {
  categories?: { strCategory: string; strCategoryThumb: string | null }[];
}

export async function mealDbFetchCategories(): Promise<
  { category: string; thumbUrl: string | null }[]
> {
  const data = await mealDbFetch<MealDbCategoriesResponse>('categories.php');
  if (!data?.categories) return [];
  return data.categories.map((row) => ({
    category: row.strCategory.trim(),
    thumbUrl: row.strCategoryThumb?.trim() || null,
  }));
}

export interface MealDbLookupMealOptions {
  priority?: MealDbLookupPriority;
  signal?: AbortSignal;
}

export async function mealDbLookupMeal(
  idMeal: string,
  options?: MealDbLookupMealOptions,
): Promise<MealDbMealDetail | null> {
  const path = `lookup.php?i=${encodeURIComponent(idMeal)}`;
  const priority = options?.priority ?? 'background';
  const signal = options?.signal;
  if (signal?.aborted) return null;
  const cached = readCacheEntry(path);
  if (cached && !cached.failed && cacheFresh(cached)) {
    if (shouldStaleRevalidate(cached, path)) {
      void revalidateMealDbFetch<MealDbMealsResponse>(path, priority, { signal });
    }
    const data = cached.payload as MealDbMealsResponse | null;
    return data?.meals?.[0] ?? null;
  }
  const data = await revalidateMealDbFetch<MealDbMealsResponse>(path, priority, { signal });
  const meal = data?.meals?.[0];
  return meal ?? null;
}

export async function mealDbRandomMeal(): Promise<MealDbMealDetail | null> {
  const data = await mealDbFetch<MealDbMealsResponse>('random.php');
  const meal = data?.meals?.[0];
  return meal ?? null;
}

export async function mealDbSearchByName(query: string): Promise<string[]> {
  const q = query.trim();
  if (!q) return [];
  const path = `search.php?s=${encodeURIComponent(q)}`;
  const data = await mealDbFetch<MealDbMealsResponse>(path);
  if (!data?.meals) return [];
  return data.meals.map((row) => row.idMeal);
}

export interface MealDbLookupMealsOptions {
  concurrency?: number;
  onMeal?: (meal: MealDbMealDetail) => void;
  onFailed?: (idMeal: string) => void;
  priority?: MealDbLookupPriority;
  signal?: AbortSignal;
}

export async function mealDbLookupMeals(
  ids: readonly string[],
  options?: MealDbLookupMealsOptions,
): Promise<MealDbMealDetail[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  const priority = options?.priority ?? 'background';
  const meals: MealDbMealDetail[] = [];

  const signal = options?.signal;
  await mapWithConcurrency(unique, options?.concurrency ?? unique.length, async (id) => {
    if (signal?.aborted) return;
    const meal = await mealDbLookupMeal(id, { priority, signal });
    if (signal?.aborted) return;
    if (!meal) {
      options?.onFailed?.(id);
      return;
    }
    meals.push(meal);
    options?.onMeal?.(meal);
  });

  return meals;
}

/** Clears in-memory MealDB caches (for unit tests). */
export function resetMealDbClientCacheForTests(): void {
  memoryCache.clear();
  inFlight.clear();
  inFlightGeneration = 0;
  resetMealDbLookupSchedulerForTests();
}

function invalidateMealDbClientPaths(paths: readonly string[], prefixMatch?: (pathKey: string) => boolean): void {
  const keysToDrop: string[] = [];
  for (const key of memoryCache.keys()) {
    if (paths.includes(key) || prefixMatch?.(key)) {
      keysToDrop.push(key);
    }
  }
  for (const key of keysToDrop) {
    memoryCache.delete(key);
    dropInFlightEntry(key);
    removeStorageKey(persistentKey(key));
  }
  const storagePrefix = persistentKey('');
  for (const storageKey of listStorageKeysWithPrefix(storagePrefix)) {
    const pathKey = storageKey.slice(storagePrefix.length);
    if (paths.includes(pathKey) || prefixMatch?.(pathKey)) {
      removeStorageKey(storageKey);
    }
  }
}

export function invalidateMealDbClientCacheForHomeRefresh(): void {
  invalidateMealDbClientPaths([], (pathKey) =>
    pathKey.startsWith('filter.php') ||
    pathKey.startsWith('lookup.php') ||
    pathKey === 'categories.php',
  );
}

/** Home toolbar refresh: drop list caches only; keep meal lookups for lazy reuse. */
export function invalidateMealDbListClientCacheForHomeRefresh(): void {
  invalidateMealDbClientPaths([], (pathKey) =>
    pathKey.startsWith('filter.php') || pathKey === 'categories.php',
  );
}

export function invalidateMealDbFilterCacheForCategory(category: string): void {
  const path = `filter.php?c=${encodeURIComponent(category.trim())}`;
  dropFailedCacheEntry(path);
  memoryCache.delete(path);
  inFlight.delete(path);
  removeStorageKey(persistentKey(path));
}

export function revalidateStaleMealDbPaths(paths: readonly string[]): void {
  for (const path of paths) {
    const entry = readCacheEntry(path);
    if (!entry || entry.failed) continue;
    if (shouldStaleRevalidate(entry, path)) {
      void revalidateMealDbFetch(path);
    }
  }
}

/** Sync read of a previously fetched lookup result (no network). */
export function readCachedMealDbAppRecipe(recipeId: string): Recipe | null {
  const idMeal = mealDbIdFromRecipeId(recipeId);
  if (!idMeal) return null;
  const path = `lookup.php?i=${encodeURIComponent(idMeal)}`;
  const cached = readCacheEntry(path);
  if (!cached || cached.failed) return null;
  const data = cached.payload as MealDbMealsResponse | null;
  const meal = data?.meals?.[0];
  if (!meal) return null;
  return mealDbMealToAppRecipe(meal);
}
