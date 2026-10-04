/**
 * Central switches for where recipe content comes from in the app.
 * RecipeAPI discovery can be paused without deleting integration code.
 */
export const RECIPE_SOURCES = {
  /** When false, RecipeAPI list/detail/search is not fetched or shown in the Recipes feed. */
  recipeApiEnabled: false,
  /** Published rows from `library_recipes` (Supabase). Paused — viral shelf is the primary feed. */
  libraryRecipesEnabled: false,
  /**
   * Built-in `kitchenCatalog` fallback when library is empty (off while viral feed is primary).
   */
  builtInCatalogWhenLibraryEmpty: false,
  /** YouTube viral shelf is the main Recipes tab grid (tap-to-import). */
  viralRecipesPrimaryFeed: true,
} as const;
