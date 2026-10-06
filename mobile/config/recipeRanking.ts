export const RECIPE_RANKING = {
  guestEventsStorageKey: 'mealprep.guest.recipeEngagementEvents',
  eventsStoragePrefix: 'mealprep.recipeEngagementEvents',
  maxStoredEvents: 2000,
  maxStoredAgeDays: 180,
  coldStartMinCookSaveEvents: 5,
  impressionDedupeMs: 5 * 60 * 1000,
} as const;

export const RECIPE_RANKING_COPY = {
  wontCookAgain: "Won't cook again",
  wontCookAgainUndo: 'Undo',
  wontCookAgainHint: 'Hide from your recipe lists',
} as const;
