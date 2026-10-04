/**
 * Central switches for where recipe content comes from in the app.
 * RecipeAPI discovery can be paused without deleting integration code.
 */
export const RECIPE_SOURCES = {
  /** When false, RecipeAPI list/detail/search is not fetched or shown in the Recipes feed. */
  recipeApiEnabled: false,
  /** Published rows from `library_recipes` (Supabase). Paused — creator shelf is the primary feed. */
  libraryRecipesEnabled: false,
  /**
   * Built-in `kitchenCatalog` fallback when library is empty (off while creator feed is primary).
   */
  builtInCatalogWhenLibraryEmpty: false,
  /** Trusted creator videos are the main Recipes tab grid (tap-to-import). */
  creatorRecipesPrimaryFeed: true,
  /** Legacy YouTube keyword shelf — kept deployed but not used by the UI. */
  viralRecipesPrimaryFeed: false,
} as const;
