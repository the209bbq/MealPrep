/**
 * Recipe ↔ pantry matching defaults for the Recipes tab and home recommendations.
 */

/** Default minimum match % when the user has not changed the filter chips. */
export const DEFAULT_MIN_PANTRY_MATCH_PERCENT = 50;

/** Recipes must match at least this many pantry ingredients (non-staples) to appear. */
export const DEFAULT_MIN_MATCHED_INGREDIENTS = 2;

/** Max pantry ingredient names to use as RecipeAPI search queries per refresh. */
export const PANTRY_DISCOVERY_MAX_QUERIES = 5;

/** Recipes returned per pantry ingredient query (keep low for API quota). */
export const PANTRY_DISCOVERY_PER_QUERY = 6;
