/**
 * Trusted creator recipe shelf — cached YouTube metadata from enabled channels.
 */

export const CREATOR_RECIPES_FEED_MODES = ['popular', 'new', 'quick', 'budget'] as const;

export type CreatorRecipesFeedMode = (typeof CREATOR_RECIPES_FEED_MODES)[number];

export type CreatorRecipesBrowseMode = CreatorRecipesFeedMode;

export const CREATOR_RECIPES = {
  enabled: true,
  requestTimeoutMs: 20_000,
  proxyUrl: process.env.EXPO_PUBLIC_CREATOR_VIDEOS_URL ?? '',
  clientCacheTtlMs: 15 * 60 * 1000,
  /** Background revalidate persisted creator responses after this age. */
  staleRevalidateAfterMs: 24 * 60 * 60 * 1000,
  migrationFilePath: 'mobile/supabase/migrations/20261004120000_recipe_creators.sql',
} as const;

export const CREATOR_RECIPES_FEED_MODE_LABELS: Record<CreatorRecipesFeedMode, string> = {
  popular: 'Popular',
  new: 'New',
  quick: 'Quick',
  budget: 'Budget',
};

/** Compact labels for the feed dropdown trigger on narrow toolbars. */
export const CREATOR_RECIPES_FEED_MODE_SHORT_LABELS: Record<CreatorRecipesFeedMode, string> = {
  popular: 'Popular',
  new: 'New',
  quick: 'Quick',
  budget: 'Budget',
};

export const CREATOR_RECIPES_COPY = {
  feedTitle: 'Recipes from creators you trust',
  creatorsSectionTitle: 'See more creator recipes!',
  cardTapToImport: 'Tap to preview',
  sourceClassic: 'Classic',
  loading: 'Loading recipes…',
  loadingCreators: 'Loading creators…',
  emptyCreators: 'Creators are being added — check back soon.',
  emptyVideos: 'No videos in this feed yet.',
  emptySearch: 'No recipes matched your search.',
  error: 'Could not load creator recipes right now.',
  feedAccessibility: 'Choose recipe feed',
  creatorRowAccessibility: 'Browse recipes by creator',
  searchPlaceholder: 'Search recipes',
  fullRecipesAtHost: (host: string) => `Full recipes at ${host}`,
} as const;
