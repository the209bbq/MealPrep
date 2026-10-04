import type { NormalizedRecipeShape } from '../recipes/normalizedRecipeShape';
import type { ViralRecipeLinkItem } from '../viralRecipes/types';

export type SavedRecipeSourceType = 'kitchen' | 'creator_video' | 'mealdb';

export interface SavedRecipeRecord {
  refKey: string;
  sourceType: SavedRecipeSourceType;
  kitchenRecipeId?: string | null;
  creatorVideoId?: string | null;
  creatorWatchUrl?: string | null;
  mealdbId?: string | null;
  title: string;
  imageUrl?: string | null;
  preview: SavedRecipePreview;
  savedAt: string;
}

export type SavedRecipePreview =
  | { kind: 'none' }
  | { kind: 'creator'; item: ViralRecipeLinkItem }
  | { kind: 'mealdb'; shape: NormalizedRecipeShape };

export interface UserSavedRecipeRow {
  id: string;
  user_id: string;
  ref_key: string;
  source_type: SavedRecipeSourceType;
  kitchen_recipe_id: string | null;
  creator_video_id: string | null;
  creator_watch_url: string | null;
  mealdb_id: string | null;
  title: string;
  image_url: string | null;
  preview: Record<string, unknown>;
  created_at: string;
}
