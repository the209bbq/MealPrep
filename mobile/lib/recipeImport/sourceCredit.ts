import type { Recipe } from '../../types/mealprep';
import type { RecipeImportExtractedDto } from './types';
import { sanitizeHttpUrl } from './safeHttpUrl';

export interface RecipeSourceCredit {
  creatorName?: string;
  creatorUrl?: string;
  originalUrl?: string;
}

function safeLink(url: string | null | undefined): string | undefined {
  return sanitizeHttpUrl(url) ?? undefined;
}

export function sourceCreditFromImportDto(draft: RecipeImportExtractedDto): RecipeSourceCredit {
  const originalUrl = safeLink(draft.source_url);
  if (draft.source_type === 'youtube') {
    const creatorName = draft.youtube_channel_name?.trim() || draft.social_author_name?.trim();
    const creatorUrl = safeLink(draft.youtube_channel_url) ?? safeLink(draft.social_author_url);
    return { creatorName, creatorUrl, originalUrl };
  }
  const creatorName = draft.social_author_name?.trim();
  const creatorUrl = safeLink(draft.social_author_url);
  return { creatorName, creatorUrl, originalUrl };
}

export function sourceCreditFromRecipe(recipe: Recipe): RecipeSourceCredit {
  const originalUrl = safeLink(recipe.sourceUrl);
  if (recipe.sourceType === 'youtube') {
    return {
      creatorName: recipe.sourceChannelName?.trim(),
      creatorUrl: safeLink(recipe.sourceChannelUrl),
      originalUrl,
    };
  }
  if (
    recipe.sourceType === 'tiktok' ||
    recipe.sourceType === 'instagram' ||
    recipe.sourceType === 'facebook'
  ) {
    return {
      creatorName: recipe.sourceTitle?.trim(),
      creatorUrl: safeLink(recipe.sourceAuthorUrl),
      originalUrl,
    };
  }
  return {
    creatorName: recipe.sourceTitle?.trim(),
    creatorUrl: safeLink(recipe.sourceAuthorUrl),
    originalUrl,
  };
}
