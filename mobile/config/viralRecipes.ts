/**
 * Viral recipe shelf — YouTube link-out cards (metadata only; save uses private recipe-import).
 */

export const VIRAL_RECIPES_CATEGORIES = ['viral', 'quick', 'budget'] as const;

export type ViralRecipesCategory = (typeof VIRAL_RECIPES_CATEGORIES)[number];

export const VIRAL_RECIPES = {
  enabled: true,
  requestTimeoutMs: 20_000,
  proxyUrl: process.env.EXPO_PUBLIC_VIRAL_RECIPES_URL ?? '',
  clientCacheTtlMs: 30 * 60 * 1000,
  migrationFilePath: 'mobile/supabase/migrations/20261003170000_viral_recipes_cache.sql',
} as const;

export const VIRAL_RECIPES_CATEGORY_LABELS: Record<ViralRecipesCategory, string> = {
  viral: 'Viral',
  quick: 'Quick',
  budget: 'Budget',
};

export const VIRAL_RECIPES_CATEGORY_QUERIES: Record<ViralRecipesCategory, string> = {
  viral: 'viral recipe',
  quick: 'easy dinner recipe',
  budget: 'budget meal recipe',
};

export const VIRAL_RECIPES_COPY = {
  shelfTitle: 'Viral recipes',
  shelfSubtitle: 'Trending cooking videos — tap to watch, save to your collection',
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
