/**
 * Central switches for where recipe content comes from in the app.
 * RecipeAPI discovery can be paused without deleting integration code.
 */
export const RECIPE_SOURCES = {
  /** When false, RecipeAPI list/detail/search is not fetched or shown in the Recipes feed. */
  recipeApiEnabled: false,
  /** Published rows from `library_recipes` (Supabase) power the Recipes tab feed. */
  libraryRecipesEnabled: true,
  /**
   * Built-in `kitchenCatalog` recipes appear in the feed only when no published library
   * recipes are loaded yet (keeps empty-library deploys usable).
   */
  builtInCatalogWhenLibraryEmpty: true,
} as const;
