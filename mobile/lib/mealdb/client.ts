import { MEALDB, mealDbApiBaseUrl } from '../../config/mealdb';
import { readJson, writeJson } from '../storage';
import type { MealDbFilterResponse, MealDbMealDetail, MealDbMealsResponse } from './types';

interface CacheEntry {
  payload: unknown;
  expiresAt: number;
  failed?: boolean;
}

const memoryCache = new Map<string, CacheEntry>();

function persistentKey(key: string): string {
  return `${MEALDB.cacheKeyPrefix}:${key}`;
}

function readCache(key: string): CacheEntry | null {
  const hit = memoryCache.get(key);
  if (hit) {
    if (hit.expiresAt < Date.now()) memoryCache.delete(key);
    else return hit;
  }
  const persisted = readJson<CacheEntry | null>(persistentKey(key), null);
  if (!persisted || persisted.expiresAt < Date.now()) return null;
  memoryCache.set(key, persisted);
  return persisted;
}

function writeCache(key: string, payload: unknown, ttlMs: number, failed = false): void {
  const entry: CacheEntry = { payload, expiresAt: Date.now() + ttlMs, failed };
  memoryCache.set(key, entry);
  writeJson(persistentKey(key), entry);
}

async function mealDbFetch<T>(path: string): Promise<T | null> {
  const cacheKey = path;
  const cached = readCache(cacheKey);
  if (cached && !cached.failed) return cached.payload as T;
  if (cached?.failed) return null;

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
    writeCache(cacheKey, json, MEALDB.clientCacheTtlMs);
    return json;
  } catch {
    writeCache(cacheKey, null, MEALDB.failureCacheTtlMs, true);
    return null;
  } finally {
    clearTimeout(timeout);
  }
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

export async function mealDbLookupMeals(ids: readonly string[]): Promise<MealDbMealDetail[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  const meals: MealDbMealDetail[] = [];
  for (const id of unique) {
    const meal = await mealDbLookupMeal(id);
    if (meal) meals.push(meal);
  }
  return meals;
}
