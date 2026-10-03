import { searchYoutubeRecipeVideo } from './youtubeSearch.ts';
import type { RecipeImportExtracted } from './recipeImportSchema.ts';

export interface AutoYoutubeImportSuccess {
  recipe: RecipeImportExtracted;
  cached: boolean;
  channelTitle: string;
  watchUrl: string;
}

type ImportFromUrlFn = (
  apiKey: string,
  normalizedUrl: string,
  sourceType: 'youtube' | 'web',
) => Promise<
  | { recipe: RecipeImportExtracted; cached: boolean }
  | { notRecipe: true; message: string; captionForSearch?: string; creatorHint?: string | null }
  | null
>;

export async function tryAutoImportFromYoutubeSearch(
  apiKey: string,
  importFromUrl: ImportFromUrlFn,
  captionForSearch: string,
  creatorHint: string | null,
): Promise<AutoYoutubeImportSuccess | null> {
  const youtubeKey = Deno.env.get('YOUTUBE_API_KEY') ?? '';
  if (!youtubeKey.trim() || !captionForSearch.trim()) return null;

  const suggestion = await searchYoutubeRecipeVideo(
    youtubeKey,
    creatorHint,
    captionForSearch,
  );
  if (!suggestion) return null;

  const result = await importFromUrl(apiKey, suggestion.watchUrl, 'youtube');
  if (!result || ('notRecipe' in result && result.notRecipe)) return null;

  return {
    recipe: result.recipe,
    cached: result.cached,
    channelTitle: suggestion.channelTitle,
    watchUrl: suggestion.watchUrl,
  };
}
