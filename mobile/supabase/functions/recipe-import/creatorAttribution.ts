import type { RecipeImportExtracted } from './recipeImportSchema.ts';
import type { RecipeImportSourceType } from './urlClassification.ts';
import { extractPageAuthorFromHtml } from './pageAuthorMeta.ts';
import { resolveYouTubeCreatorMeta } from './youtubeCreatorMeta.ts';

export function recipeMissingCreatorFields(
  recipe: RecipeImportExtracted,
  sourceType: RecipeImportSourceType,
): boolean {
  if (sourceType === 'youtube') {
    return !recipe.youtube_channel_name?.trim() || !recipe.youtube_channel_url?.trim();
  }
  if (sourceType === 'tiktok' || sourceType === 'instagram' || sourceType === 'facebook' || sourceType === 'web') {
    return !recipe.social_author_name?.trim();
  }
  return false;
}

export function applyYouTubeCreatorMeta(
  recipe: RecipeImportExtracted,
  meta: { channelName: string; channelUrl: string },
): RecipeImportExtracted {
  const now = new Date().toISOString();
  return {
    ...recipe,
    youtube_channel_name: meta.channelName,
    youtube_channel_url: meta.channelUrl,
    metadata_refreshed_at: now,
    social_author_name: meta.channelName,
    social_author_url: meta.channelUrl,
  };
}

export function applySocialAuthorMeta(
  recipe: RecipeImportExtracted,
  meta: { authorName: string; authorUrl: string | null },
): RecipeImportExtracted {
  return {
    ...recipe,
    social_author_name: meta.authorName,
    social_author_url: meta.authorUrl ?? recipe.source_url,
  };
}

export async function enrichYouTubeRecipeCreator(
  recipe: RecipeImportExtracted,
  normalizedUrl: string,
  watchUrl: string,
): Promise<RecipeImportExtracted> {
  if (!recipeMissingCreatorFields(recipe, 'youtube')) return recipe;
  const meta = await resolveYouTubeCreatorMeta(normalizedUrl, watchUrl);
  if (!meta) return recipe;
  return applyYouTubeCreatorMeta(recipe, meta);
}

export async function enrichWebRecipeCreator(
  recipe: RecipeImportExtracted,
  html: string,
): Promise<RecipeImportExtracted> {
  if (!recipeMissingCreatorFields(recipe, 'web')) return recipe;
  const meta = extractPageAuthorFromHtml(html);
  if (!meta) return recipe;
  return applySocialAuthorMeta(recipe, meta);
}
