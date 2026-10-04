/**
 * Trusted creator recipe shelf — cached YouTube metadata from enabled channels.
 */

import { MEALDB_COPY } from './mealdb';

export const CREATOR_RECIPES_FEED_MODES = [
  'popular',
  'new',
  'quick',
  'budget',
  'classic_recipes',
] as const;

export type CreatorRecipesFeedMode = (typeof CREATOR_RECIPES_FEED_MODES)[number];

export type CreatorRecipesBrowseMode = Exclude<CreatorRecipesFeedMode, 'classic_recipes'>;

export function isCreatorBrowseMode(mode: CreatorRecipesFeedMode): mode is CreatorRecipesBrowseMode {
  return mode !== 'classic_recipes';
}

export function isClassicRecipesFeedMode(mode: CreatorRecipesFeedMode): boolean {
  return mode === 'classic_recipes';
}

export const CREATOR_RECIPES = {
  enabled: true,
  requestTimeoutMs: 20_000,
  proxyUrl: process.env.EXPO_PUBLIC_CREATOR_VIDEOS_URL ?? '',
  clientCacheTtlMs: 15 * 60 * 1000,
  migrationFilePath: 'mobile/supabase/migrations/20261004120000_recipe_creators.sql',
} as const;

export const CREATOR_RECIPES_FEED_MODE_LABELS: Record<CreatorRecipesFeedMode, string> = {
  popular: 'Popular',
  new: 'New',
  quick: 'Quick',
  budget: 'Budget',
  classic_recipes: MEALDB_COPY.feedModeLabel,
};

export const CREATOR_RECIPES_COPY = {
  feedTitle: 'Recipes from creators you trust',
  feedSubtitle: 'Cook from real video recipes — tap to import and match your pantry',
  cardTapToImport: 'Tap to import & match your pantry',
  sourceClassic: 'Classic',
  loading: 'Loading recipes…',
  loadingCreators: 'Loading creators…',
  emptyCreators: 'Creators are being added — check back soon.',
  emptyVideos: 'No videos in this feed yet.',
  emptySearch: 'No recipes matched your search.',
  error: 'Could not load creator recipes right now.',
  feedAccessibility: 'Choose recipe feed',
  creatorRowAccessibility: 'Browse recipes by creator',
  searchPlaceholder: 'Search recipes and creators',
} as const;
