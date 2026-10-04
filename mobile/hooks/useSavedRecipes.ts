import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { CreatorVideoItem } from '../lib/creatorVideos/types';
import {
  readGuestSavedRecipes,
  removeGuestSavedRecipe,
  upsertGuestSavedRecipe,
} from '../lib/savedRecipes/localStore';
import {
  savedRecordFromCreatorVideo,
  savedRecordFromKitchenRecipe,
  savedRecordFromMealDbRecipe,
  savedRecordFromViralItem,
} from '../lib/savedRecipes/payloads';
import type { ViralRecipeLinkItem } from '../lib/viralRecipes/types';
import { savedRefKeyCreator, savedRefKeyKitchen, savedRefKeyMealDb } from '../lib/savedRecipes/keys';
import { mealDbIdFromKitchenRecipe } from '../lib/savedRecipes/preview';
import {
  buildSavedRecipeFeedRows,
  savedCreatorItemFromRecord,
} from '../lib/savedRecipes/resolveRows';
import {
  deleteUserSavedRecipe,
  fetchUserSavedRecipes,
  upsertUserSavedRecipe,
} from '../lib/savedRecipes/supabaseStore';
import type { PantryMatchIndex } from '../lib/recipeMatch';
import { getSupabase } from '../lib/supabase';
import type { PantryItem, Recipe } from '../types/mealprep';
import type { SavedRecipeRecord } from '../lib/savedRecipes/types';
import { isMealDbRecipeId } from '../lib/mealdb/normalize';

export function useSavedRecipes(options: {
  session: Session | null;
  demoMode: boolean;
  isGuest: boolean;
  kitchenRecipes: readonly Recipe[];
  pantry: PantryItem[];
  pantryMatches: PantryMatchIndex;
}) {
  const { session, demoMode, isGuest, kitchenRecipes, pantry, pantryMatches } = options;
  const userId = session?.user?.id ?? null;
  const supabase = getSupabase();
  const [records, setRecords] = useState<SavedRecipeRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const savedKeys = useMemo(() => new Set(records.map((row) => row.refKey)), [records]);

  const load = useCallback(async () => {
    if (demoMode) {
      setRecords([]);
      setHydrated(true);
      return;
    }
    if (isGuest || !userId || !supabase) {
      setRecords(readGuestSavedRecipes());
      setHydrated(true);
      return;
    }
    try {
      const rows = await fetchUserSavedRecipes(supabase, userId);
      setRecords(rows);
    } catch {
      setRecords([]);
    } finally {
      setHydrated(true);
    }
  }, [demoMode, isGuest, supabase, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const persistRef = useRef(0);

  const toggleRefKey = useCallback(
    async (refKey: string, nextRecord: SavedRecipeRecord | null) => {
      persistRef.current += 1;
      const token = persistRef.current;

      if (demoMode) return;

      if (isGuest || !userId || !supabase) {
        if (nextRecord) {
          setRecords(upsertGuestSavedRecipe(nextRecord));
        } else {
          setRecords(removeGuestSavedRecipe(refKey));
        }
        return;
      }

      const optimistic = nextRecord
        ? [nextRecord, ...records.filter((row) => row.refKey !== refKey)]
        : records.filter((row) => row.refKey !== refKey);
      setRecords(optimistic);

      try {
        if (nextRecord) {
          await upsertUserSavedRecipe(supabase, userId, nextRecord);
        } else {
          await deleteUserSavedRecipe(supabase, userId, refKey);
        }
      } catch {
        if (token === persistRef.current) {
          void load();
        }
      }
    },
    [demoMode, isGuest, load, records, supabase, userId],
  );

  const isSavedRef = useCallback((refKey: string) => savedKeys.has(refKey), [savedKeys]);

  const isKitchenSaved = useCallback(
    (recipe: Recipe) => {
      const mealdbId = mealDbIdFromKitchenRecipe(recipe);
      if (mealdbId && savedKeys.has(savedRefKeyMealDb(mealdbId))) return true;
      return savedKeys.has(savedRefKeyKitchen(recipe.id));
    },
    [savedKeys],
  );

  const isCreatorSaved = useCallback(
    (videoId: string, importedRecipe: Recipe | null) => {
      if (importedRecipe && isKitchenSaved(importedRecipe)) return true;
      return savedKeys.has(savedRefKeyCreator(videoId));
    },
    [isKitchenSaved, savedKeys],
  );

  const toggleKitchenRecipe = useCallback(
    (recipe: Recipe) => {
      const record = isMealDbRecipeId(recipe.id) || recipe.sourceType === 'themealdb'
        ? savedRecordFromMealDbRecipe(recipe)
        : savedRecordFromKitchenRecipe(recipe);
      const saved = isSavedRef(record.refKey);
      void toggleRefKey(record.refKey, saved ? null : record);
    },
    [isSavedRef, toggleRefKey],
  );

  const toggleViralItem = useCallback(
    (item: ViralRecipeLinkItem, importedRecipe: Recipe | null) => {
      if (importedRecipe) {
        toggleKitchenRecipe(importedRecipe);
        return;
      }
      const record = savedRecordFromViralItem(item);
      const saved = isSavedRef(record.refKey);
      void toggleRefKey(record.refKey, saved ? null : record);
    },
    [isSavedRef, toggleKitchenRecipe, toggleRefKey],
  );

  const toggleCreatorVideo = useCallback(
    (video: CreatorVideoItem, importedRecipe: Recipe | null) => {
      if (importedRecipe) {
        toggleKitchenRecipe(importedRecipe);
        return;
      }
      const record = savedRecordFromCreatorVideo(video);
      const saved = isSavedRef(record.refKey);
      void toggleRefKey(record.refKey, saved ? null : record);
    },
    [isSavedRef, toggleKitchenRecipe, toggleRefKey],
  );

  const feedRows = useMemo(
    () => buildSavedRecipeFeedRows(records, kitchenRecipes, pantry, pantryMatches),
    [kitchenRecipes, pantry, pantryMatches, records],
  );

  const openCreatorFromSaved = useCallback(
    (record: SavedRecipeRecord) => savedCreatorItemFromRecord(record),
    [],
  );

  return {
    hydrated,
    records,
    feedRows,
    isSavedRef,
    isKitchenSaved,
    isCreatorSaved,
    toggleKitchenRecipe,
    toggleCreatorVideo,
    toggleViralItem,
    openCreatorFromSaved,
    reload: load,
  };
}
