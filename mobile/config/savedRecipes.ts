export const SAVED_RECIPES = {
  table: 'user_saved_recipes',
  migrationFilePath: 'mobile/supabase/migrations/20261004200000_user_saved_recipes.sql',
  guestStorageKey: 'mealprep.guest.savedRecipes',
} as const;

export const SAVED_RECIPES_COPY = {
  myRecipesButton: 'My Recipes',
  myRecipesTitle: 'My Recipes',
  empty: 'Save recipes with the bookmark icon to find them here.',
  guestHint: 'Sign in to keep saved recipes on all your devices.',
  save: 'Save recipe',
  unsave: 'Remove from My Recipes',
  saved: 'Saved',
} as const;
