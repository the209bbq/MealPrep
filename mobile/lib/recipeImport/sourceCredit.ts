import type { Recipe } from '../../types/mealprep';
import type { RecipeImportExtractedDto } from './types';

export interface RecipeSourceCredit {
  creatorName?: string;
  creatorUrl?: string;
  originalUrl?: string;
}

export function sourceCreditFromImportDto(draft: RecipeImportExtractedDto): RecipeSourceCredit {
  const originalUrl = draft.source_url?.trim() || undefined;
  if (draft.source_type === 'youtube') {
    const creatorName = draft.youtube_channel_name?.trim() || draft.social_author_name?.trim();
    const creatorUrl = draft.youtube_channel_url?.trim() || draft.social_author_url?.trim();
    return { creatorName, creatorUrl, originalUrl };
  }
  const creatorName = draft.social_author_name?.trim();
  const creatorUrl = draft.social_author_url?.trim();
  return { creatorName, creatorUrl, originalUrl };
}

export function sourceCreditFromRecipe(recipe: Recipe): RecipeSourceCredit {
  const originalUrl = recipe.sourceUrl?.trim() || undefined;
  if (recipe.sourceType === 'youtube') {
    return {
      creatorName: recipe.sourceChannelName?.trim(),
      creatorUrl: recipe.sourceChannelUrl?.trim(),
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
      creatorUrl: recipe.sourceAuthorUrl?.trim(),
      originalUrl,
    };
  }
  return {
    creatorName: recipe.sourceTitle?.trim(),
    creatorUrl: recipe.sourceAuthorUrl?.trim(),
    originalUrl,
  };
}
