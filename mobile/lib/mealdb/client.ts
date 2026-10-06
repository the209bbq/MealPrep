import { MEALDB, mealDbApiBaseUrl } from '../../config/mealdb';
import { mapWithConcurrency } from '../concurrency';
import { readJson, writeJson } from '../storage';
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
  failed?: boolean;
}

const memoryCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

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
  const entry: CacheEntry = { payload, expiresAt: Date.now() + ttlMs, failed };
  memoryCache.set(key, entry);
  writeJson(persistentKey(key), entry);
}

function cacheFresh(entry: CacheEntry): boolean {
  return entry.expiresAt >= Date.now();
}

function cacheTtlMsForPath(path: string): number {
  if (path.startsWith('lookup.php')) return MEALDB.lookupCacheTtlMs;
  return MEALDB.filterCacheTtlMs;
}

async function fetchMealDbPath<T>(path: string): Promise<T | null> {
  const cacheKey = path;
  const url = `${mealDbApiBaseUrl()}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MEALDB.requestTimeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      writeCache(cacheKey, null, MEALDB.failureCacheTtlMs, true);
      return null;
    }
    const json = (await response.json()) as T;
    writeCache(cacheKey, json, cacheTtlMsForPath(path));
    return json;
  } catch {
    writeCache(cacheKey, null, MEALDB.failureCacheTtlMs, true);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function mealDbFetch<T>(path: string): Promise<T | null> {
  const cacheKey = path;
  const cached = readCacheEntry(cacheKey);
  if (cached) {
    if (cached.failed) {
      if (cacheFresh(cached)) return null;
    } else if (cacheFresh(cached)) {
      return cached.payload as T;
    } else {
      void revalidateMealDbFetch<T>(path);
      return cached.payload as T;
    }
  }
  return revalidateMealDbFetch<T>(path);
}

async function revalidateMealDbFetch<T>(path: string): Promise<T | null> {
  const cacheKey = path;
  const existing = inFlight.get(cacheKey);
  if (existing) return existing as Promise<T | null>;
  const promise = fetchMealDbPath<T>(path).finally(() => {
    inFlight.delete(cacheKey);
  });
  inFlight.set(cacheKey, promise);
  return promise;
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
  return summaries.map((row) => row.idMeal);
}

export async function mealDbFilterSummariesByCategory(
  category: string,
): Promise<MealDbFilterMealSummary[]> {
  const path = `filter.php?c=${encodeURIComponent(category.trim())}`;
  const data = await mealDbFetch<MealDbFilterResponse>(path);
  if (!data?.meals) return [];
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

export async function mealDbLookupMeal(idMeal: string): Promise<MealDbMealDetail | null> {
  const path = `lookup.php?i=${encodeURIComponent(idMeal)}`;
  const data = await mealDbFetch<MealDbMealsResponse>(path);
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
}

export async function mealDbLookupMeals(
  ids: readonly string[],
  options?: MealDbLookupMealsOptions,
): Promise<MealDbMealDetail[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  const concurrency = options?.concurrency ?? MEALDB.maxConcurrentRequests;
  const meals: MealDbMealDetail[] = [];

  await mapWithConcurrency(unique, concurrency, async (id) => {
    const meal = await mealDbLookupMeal(id);
    if (!meal) return;
    meals.push(meal);
    options?.onMeal?.(meal);
  });

  return meals;
}

/** Clears in-memory MealDB caches (for unit tests). */
export function resetMealDbClientCacheForTests(): void {
  memoryCache.clear();
  inFlight.clear();
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
