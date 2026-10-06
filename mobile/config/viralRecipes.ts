/**
 * Viral recipe shelf — YouTube link-out cards (metadata only; save uses private recipe-import).
 */

import { MEALDB_COPY } from './mealdb';

export const VIRAL_RECIPES_CATEGORIES = ['viral', 'quick', 'budget'] as const;

export type ViralRecipesCategory = (typeof VIRAL_RECIPES_CATEGORIES)[number];

export const VIRAL_RECIPES_FEED_MODES = [...VIRAL_RECIPES_CATEGORIES, 'classic_recipes'] as const;

export type ViralRecipesFeedMode = (typeof VIRAL_RECIPES_FEED_MODES)[number];

export function isViralRecipesCategory(mode: ViralRecipesFeedMode): mode is ViralRecipesCategory {
  return mode !== 'classic_recipes';
}

export function isClassicRecipesFeedMode(mode: ViralRecipesFeedMode): boolean {
  return mode === 'classic_recipes';
}

export const VIRAL_RECIPES = {
  enabled: true,
  requestTimeoutMs: 20_000,
  proxyUrl: process.env.EXPO_PUBLIC_VIRAL_RECIPES_URL ?? '',
  clientCacheTtlMs: 30 * 60 * 1000,
  migrationFilePath: 'mobile/supabase/migrations/20261003180000_viral_recipes_cache.sql',
} as const;

export const VIRAL_RECIPES_CATEGORY_LABELS: Record<ViralRecipesCategory, string> = {
  viral: 'Viral',
  quick: 'Quick',
  budget: 'Budget',
};

export const VIRAL_RECIPES_FEED_MODE_LABELS: Record<ViralRecipesFeedMode, string> = {
  viral: 'Viral',
  quick: 'Quick',
  budget: 'Budget',
  classic_recipes: MEALDB_COPY.feedModeLabel,
};

/** Mirrors `CATEGORY_SEARCH_QUERIES` in supabase/functions/viral-recipes/youtubeDiscovery.ts */
export const VIRAL_RECIPES_CATEGORY_QUERIES: Record<ViralRecipesCategory, readonly string[]> = {
  viral: ['viral dinner recipe', 'tiktok famous dinner recipe'],
  quick: ['15 minute dinner recipe', 'easy weeknight dinner recipe'],
  budget: ['cheap dinner recipe', 'budget family dinner recipe'],
};

export const VIRAL_RECIPES_COPY = {
  feedTitle: 'Viral recipes',
  feedSubtitle: 'Trending videos — tap to import, cook with what you already have',
  cardTapToImport: 'Tap to preview — get recipe when you are ready',
  getRecipeCta: 'Get recipe from video',
  getRecipeHint: 'Pulls ingredients and steps from the video (uses AI).',
  detailImporting: 'Pulling ingredients and steps from the video…',
  saveToMyRecipes: 'Save to My Recipes',
  detailImportErrorTitle: 'Couldn’t pull this recipe',
  detailImportErrorBody: 'Check your connection and try again, or watch the video for the full recipe.',
  watchOriginalVideo: 'Watch original video',
  shelfTitle: 'Viral recipes',
  shelfSubtitle: 'Trending cooking videos — tap to import and match your pantry',
  categoryLabel: 'Category',
  categoryAccessibility: 'Choose viral recipe category',
  loading: 'Loading ideas…',
  empty: 'No videos right now. Check back later.',
  error: 'Could not load videos right now.',
  saveCta: 'Save',
  saving: 'Saving…',
  byChannel: (channel: string) => `By ${channel}`,
  watchAccessibility: (title: string) => `Watch ${title} on YouTube`,
  saveAccessibility: (title: string) => `Save ${title} to your recipes`,
} as const;
