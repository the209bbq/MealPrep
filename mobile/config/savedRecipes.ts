export const SAVED_RECIPES = {
  table: 'user_saved_recipes',
  migrationFilePath: 'mobile/supabase/migrations/20261004200000_user_saved_recipes.sql',
  guestStorageKey: 'mealprep.guest.savedRecipes',
} as const;

export const SAVED_RECIPES_COPY = {
  myRecipesButton: 'My Recipes',
  myRecipesTitle: 'My Recipes',
  myRecipesViewAction: 'View',
  empty: 'Save recipes with the bookmark icon to find them here.',
  guestHint: 'Sign in to keep saved recipes on all your devices.',
  saveAccessibility: 'Save to My Recipes',
  savedAccessibility: 'Saved',
  savedButton: 'Saved ✓',
  toastSaved: 'Saved to My Recipes',
  toastRemoved: 'Removed from My Recipes',
  toastSaveFailed: "Couldn't save — try again",
  /** @deprecated use saveAccessibility */
  save: 'Save recipe',
  /** @deprecated use savedAccessibility */
  unsave: 'Remove from My Recipes',
  /** @deprecated use savedButton */
  saved: 'Saved',
} as const;
