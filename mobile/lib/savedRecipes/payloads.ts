import type { CreatorVideoItem } from '../creatorVideos/types';
import type { ViralRecipeLinkItem } from '../viralRecipes/types';
import { mealDbIdFromRecipeId } from '../mealdb/slug';
import { creatorVideoToImportItem } from '../recipes/creatorFeedRows';
import type { Recipe } from '../../types/mealprep';
import { savedRefKeyCreator, savedRefKeyKitchen, savedRefKeyMealDb } from './keys';
import { appRecipeToNormalizedSnapshot, mealDbIdFromKitchenRecipe } from './preview';
import type { SavedRecipeRecord } from './types';

export function savedRecordFromKitchenRecipe(recipe: Recipe, savedAt = new Date().toISOString()): SavedRecipeRecord {
  const mealdbId = mealDbIdFromKitchenRecipe(recipe);
  if (mealdbId) {
    return {
      refKey: savedRefKeyMealDb(mealdbId),
      sourceType: 'mealdb',
      mealdbId,
      kitchenRecipeId: recipe.id,
      title: recipe.name,
      imageUrl: recipe.imageUrl ?? null,
      preview: { kind: 'mealdb', shape: appRecipeToNormalizedSnapshot(recipe) },
      savedAt,
    };
  }
  return {
    refKey: savedRefKeyKitchen(recipe.id),
    sourceType: 'kitchen',
    kitchenRecipeId: recipe.id,
    title: recipe.name,
    imageUrl: recipe.imageUrl ?? null,
    preview: { kind: 'none' },
    savedAt,
  };
}

export function savedRecordFromViralItem(
  item: ViralRecipeLinkItem,
  savedAt = new Date().toISOString(),
): SavedRecipeRecord {
  return {
    refKey: savedRefKeyCreator(item.videoId),
    sourceType: 'creator_video',
    creatorVideoId: item.videoId,
    creatorWatchUrl: item.watchUrl,
    title: item.title,
    imageUrl: item.thumbnailUrl,
    preview: { kind: 'creator', item },
    savedAt,
  };
}

export function savedRecordFromCreatorVideo(
  video: CreatorVideoItem,
  savedAt = new Date().toISOString(),
): SavedRecipeRecord {
  const item = creatorVideoToImportItem(video);
  return {
    refKey: savedRefKeyCreator(video.videoId),
    sourceType: 'creator_video',
    creatorVideoId: video.videoId,
    creatorWatchUrl: video.watchUrl,
    title: video.title,
    imageUrl: video.thumbnailUrl,
    preview: { kind: 'creator', item },
    savedAt,
  };
}

export function savedRecordFromMealDbRecipe(recipe: Recipe, savedAt = new Date().toISOString()): SavedRecipeRecord {
  const idMeal = mealDbIdFromRecipeId(recipe.id) ?? mealDbIdFromKitchenRecipe(recipe);
  if (!idMeal) {
    return savedRecordFromKitchenRecipe(recipe, savedAt);
  }
  return {
    refKey: savedRefKeyMealDb(idMeal),
    sourceType: 'mealdb',
    mealdbId: idMeal,
    title: recipe.name,
    imageUrl: recipe.imageUrl ?? null,
    preview: { kind: 'mealdb', shape: appRecipeToNormalizedSnapshot(recipe) },
    savedAt,
  };
}
