/**
 * TheMealDB client recipe catalog (API v1 test key; swap premium key via env).
 * @see https://www.themealdb.com/documentation
 */

export const MEALDB = {
  apiKey: process.env.EXPO_PUBLIC_MEALDB_API_KEY?.trim() || '1',
  /** `v1` (public) or `v2` (premium — stub until premium base paths are wired). */
  apiVersion: (process.env.EXPO_PUBLIC_MEALDB_API_VERSION?.trim() || 'v1').toLowerCase(),
  requestTimeoutMs: 20_000,
  /** Full meal lookups (`lookup.php`) — details rarely change. */
  lookupCacheTtlMs: 7 * 24 * 60 * 60 * 1000,
  /** Filter/search list responses — refresh daily. */
  filterCacheTtlMs: 24 * 60 * 60 * 1000,
  /** @deprecated use lookupCacheTtlMs / filterCacheTtlMs */
  clientCacheTtlMs: 7 * 24 * 60 * 60 * 1000,
  failureCacheTtlMs: 5 * 60 * 1000,
  cacheKeyPrefix: 'mealprep.mealdb',
  maxConcurrentRequests: 6,
  /** Max filter.php ingredient queries per pantry refresh. */
  maxPantryFilterQueries: 3,
  /** Max full meal lookups after filtering. */
  maxCatalogMeals: 24,
  siteUrl: 'https://www.themealdb.com',
} as const;

export const MEALDB_COPY = {
  feedModeLabel: 'Classic recipes',
  attribution: 'From TheMealDB',
  attributionLinkLabel: 'TheMealDB',
  mealPageAccessibility: (name: string) => `View ${name} on TheMealDB`,
  loading: 'Loading classic recipes…',
  empty: 'No recipes found. Try again later.',
  error: 'Could not load classic recipes right now.',
} as const;

export function mealDbApiBaseUrl(): string {
  const key = MEALDB.apiKey;
  if (MEALDB.apiVersion === 'v2') {
    return `https://www.themealdb.com/api/json/v2/${encodeURIComponent(key)}/`;
  }
  return `https://www.themealdb.com/api/json/v1/${encodeURIComponent(key)}/`;
}

export function mealDbMealPageUrl(idMeal: string): string {
  return `${MEALDB.siteUrl}/meal/${encodeURIComponent(idMeal)}`;
}
