import type { SupabaseClient } from '@supabase/supabase-js';
import { SAVED_RECIPES } from '../../config/savedRecipes';
import { kitchenRecipeIdForDb } from './kitchenRecipeIdForDb';
import { encodePreview, previewFromUserRow } from './preview';
import type { SavedRecipeRecord, UserSavedRecipeRow } from './types';

function rowToRecord(row: UserSavedRecipeRow): SavedRecipeRecord {
  return {
    refKey: row.ref_key,
    sourceType: row.source_type,
    kitchenRecipeId: row.kitchen_recipe_id,
    creatorVideoId: row.creator_video_id,
    creatorWatchUrl: row.creator_watch_url,
    mealdbId: row.mealdb_id,
    title: row.title,
    imageUrl: row.image_url,
    preview: previewFromUserRow(row),
    savedAt: row.created_at,
  };
}

export async function fetchUserSavedRecipes(
  client: SupabaseClient,
  userId: string,
): Promise<SavedRecipeRecord[]> {
  const { data, error } = await client
    .from(SAVED_RECIPES.table)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    if (error.code === 'PGRST205') return [];
    throw error;
  }
  return (data as UserSavedRecipeRow[]).map(rowToRecord);
}

export async function upsertUserSavedRecipe(
  client: SupabaseClient,
  userId: string,
  record: SavedRecipeRecord,
  options?: { accountRecipeIds?: ReadonlySet<string> },
): Promise<SavedRecipeRecord> {
  const accountRecipeIds = options?.accountRecipeIds ?? new Set<string>();
  const payload = {
    user_id: userId,
    ref_key: record.refKey,
    source_type: record.sourceType,
    kitchen_recipe_id: kitchenRecipeIdForDb(record, accountRecipeIds),
    creator_video_id: record.creatorVideoId ?? null,
    creator_watch_url: record.creatorWatchUrl ?? null,
    mealdb_id: record.mealdbId ?? null,
    title: record.title,
    image_url: record.imageUrl ?? null,
    preview: encodePreview(record.preview),
  };
  const { data, error } = await client
    .from(SAVED_RECIPES.table)
    .upsert(payload, { onConflict: 'user_id,ref_key' })
    .select('*')
    .single();
  if (error) throw error;
  return rowToRecord(data as UserSavedRecipeRow);
}

export async function deleteUserSavedRecipe(
  client: SupabaseClient,
  userId: string,
  refKey: string,
): Promise<void> {
  const { error } = await client
    .from(SAVED_RECIPES.table)
    .delete()
    .eq('user_id', userId)
    .eq('ref_key', refKey);
  if (error) throw error;
}

export async function mergeGuestSavedRecipesIntoAccount(
  client: SupabaseClient,
  userId: string,
  guestRecords: SavedRecipeRecord[],
  options?: { accountRecipeIds?: ReadonlySet<string> },
): Promise<void> {
  for (const record of guestRecords) {
    await upsertUserSavedRecipe(client, userId, record, options);
  }
}
