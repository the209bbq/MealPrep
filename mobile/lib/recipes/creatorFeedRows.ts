import type { RecipePantryMatch } from '../recipeMatch';
import type { CreatorVideoItem } from '../creatorVideos/types';
import type { ViralRecipeLinkItem } from '../viralRecipes/types';
import type { Recipe } from '../../types/mealprep';
import { findKitchenRecipeBySourceUrl } from './recipeSourceUrl';

export function creatorVideoToImportItem(video: CreatorVideoItem): ViralRecipeLinkItem {
  return {
    videoId: video.videoId,
    category: 'quick',
    title: video.title,
    thumbnailUrl: video.thumbnailUrl,
    channelId: video.channelId,
    channelTitle: video.creatorName,
    channelUrl: video.channelUrl,
    watchUrl: video.watchUrl,
    viewCount: video.viewCount,
    publishedAt: video.publishedAt,
  };
}

export interface CreatorFeedCardModel {
  videoId: string;
  video: CreatorVideoItem;
  item: ViralRecipeLinkItem;
  importedRecipe: Recipe | null;
  match: RecipePantryMatch | null;
  sourceLabel: string;
}

function zeroMatchForRecipe(recipe: Recipe): RecipePantryMatch {
  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    totalIngredients: recipe.ingredients.length,
    matchedCount: 0,
    missingCount: recipe.ingredients.length,
    percentMatch: 0,
    matched: [],
    missing: recipe.ingredients,
  };
}

export function buildCreatorFeedCardModels(
  videos: readonly CreatorVideoItem[],
  kitchenRecipes: readonly Recipe[],
  pantryMatches: { byRecipeId: Map<string, RecipePantryMatch> },
): CreatorFeedCardModel[] {
  return videos.map((video) => {
    const item = creatorVideoToImportItem(video);
    const importedRecipe = findKitchenRecipeBySourceUrl(kitchenRecipes, item.watchUrl) ?? null;
    const match = importedRecipe
      ? pantryMatches.byRecipeId.get(importedRecipe.id) ?? zeroMatchForRecipe(importedRecipe)
      : null;
    const sourceLabel = video.creatorName.trim() || 'Creator';
    return {
      videoId: video.videoId,
      video,
      item,
      importedRecipe,
      match,
      sourceLabel,
    };
  });
}
