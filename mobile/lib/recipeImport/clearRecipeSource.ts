import type { Recipe } from '../../types/mealprep';
import type { RecipeImportExtractedDto } from './types';

/** Strip link-import attribution (e.g. Reddit post credit) from a saved recipe. */
export function recipeWithoutSourceAttribution(recipe: Recipe): Recipe {
  return {
    ...recipe,
    sourceUrl: undefined,
    sourceType: undefined,
    sourceTitle: undefined,
    sourceAuthorUrl: undefined,
    sourceChannelName: undefined,
    sourceChannelUrl: undefined,
    sourceMetadataRefreshedAt: undefined,
  };
}

export function importDtoWithoutSourceAttribution(
  draft: RecipeImportExtractedDto,
): RecipeImportExtractedDto {
  const fallbackType =
    draft.source_type === 'photo' || draft.source_type === 'video' ? draft.source_type : 'web';
  return {
    ...draft,
    source_type: fallbackType,
    source_url: fallbackType === 'photo' ? 'photo-scan' : 'text-import',
    social_author_name: null,
    social_author_url: null,
  };
}
