/**
 * Client-side RecipeAPI discovery: parallel search limits, cache TTLs, quota handling.
 */

/** Successful list/detail responses — persisted in local storage. */
export const RECIPE_DISCOVERY_CLIENT_CACHE_TTL_MS = 30 * 60 * 1000;

/** Failed list requests — short negative cache to avoid hammering the proxy. */
export const RECIPE_DISCOVERY_CLIENT_FAILURE_CACHE_TTL_MS = 5 * 60 * 1000;

/** In-memory + persisted cache key prefix. */
export const RECIPE_DISCOVERY_CLIENT_CACHE_KEY_PREFIX = 'mealprep.recipeDiscovery.list';

/** Max parallel list searches per pantry refresh (empty pantry uses browse cap). */
export const RECIPE_DISCOVERY_PARALLEL_SEARCHES = 3;

/** Browse-mode queries when pantry is empty. */
export const RECIPE_DISCOVERY_BROWSE_MAX_QUERIES = 3;

/** User-facing note when quota/rate limit aborts the online batch. */
export const RECIPE_DISCOVERY_ONLINE_UNAVAILABLE_NOTE = 'Online recipes unavailable right now';

export const RECIPE_DISCOVERY_QUOTA_ERROR_CODES = new Set(['RATE_LIMIT', 'USAGE_LIMIT_EXCEEDED']);
