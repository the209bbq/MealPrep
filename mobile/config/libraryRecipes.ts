/** MealPlanatic shared recipe library (Supabase `library_recipes`). */
export const LIBRARY_RECIPES = {
  table: 'library_recipes',
  queueTable: 'library_dish_queue',
  storageBucket: 'library-recipe-images',
  /** Recipe id prefix in the app (`library-{slug}`). */
  idPrefix: 'library-',
  clientCacheTtlMs: 15 * 60 * 1000,
  migrationFilePath: 'mobile/supabase/migrations/20261003200000_library_recipes.sql',
  seedMigrationFilePath: 'mobile/supabase/migrations/20261003201000_library_dish_queue_seed.sql',
  edgeFunctionName: 'library-generate',
  detailTag: 'MealPlanatic recipe',
} as const;
