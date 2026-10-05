import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { CreatorVideoItem } from '../lib/creatorVideos/types';
import {
  readGuestSavedRecipes,
  removeGuestSavedRecipe,
  upsertGuestSavedRecipe,
} from '../lib/savedRecipes/localStore';
import { applySavedToggle } from '../lib/savedRecipes/optimistic';
import {
  savedRecordFromCreatorVideo,
  savedRecordFromKitchenRecipe,
  savedRecordFromMealDbRecipe,
  savedRecordFromViralItem,
} from '../lib/savedRecipes/payloads';
import type { ViralRecipeLinkItem } from '../lib/viralRecipes/types';
import { savedRefKeyCreator, savedRefKeyKitchen, savedRefKeyMealDb } from '../lib/savedRecipes/keys';
import { refKeyForCreatorVideo, refKeyForKitchenRecipe } from '../lib/savedRecipes/refKey';
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

export type SavedRecipeToggleOutcome =
  | { status: 'saved'; refKey: string }
  | { status: 'removed'; undo: () => void }
  | { status: 'error' }
  | { status: 'skipped' };

export function useSavedRecipes(options: {
  session: Session | null;
  demoMode: boolean;
  isGuest: boolean;
  kitchenRecipes: readonly Recipe[];
  pantry: PantryItem[];
  pantryMatches: PantryMatchIndex;
  onToggleOutcome?: (outcome: SavedRecipeToggleOutcome) => void;
}) {
  const { session, demoMode, isGuest, kitchenRecipes, pantry, pantryMatches, onToggleOutcome } =
    options;
  const userId = session?.user?.id ?? null;
  const supabase = getSupabase();
  const [records, setRecords] = useState<SavedRecipeRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [pendingRefKeys, setPendingRefKeys] = useState<Set<string>>(() => new Set());
  const savedKeys = useMemo(() => new Set(records.map((row) => row.refKey)), [records]);
  const onToggleOutcomeRef = useRef(onToggleOutcome);
  onToggleOutcomeRef.current = onToggleOutcome;

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
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const toggleRefKeyRef = useRef<
    (refKey: string, nextRecord: SavedRecipeRecord | null) => Promise<void>
  >(async () => {});

  const setPending = useCallback((refKey: string, pending: boolean) => {
    setPendingRefKeys((prev) => {
      const next = new Set(prev);
      if (pending) next.add(refKey);
      else next.delete(refKey);
      return next;
    });
  }, []);

  const emitOutcome = useCallback((outcome: SavedRecipeToggleOutcome) => {
    onToggleOutcomeRef.current?.(outcome);
  }, []);

  const toggleRefKey = useCallback(
    async (refKey: string, nextRecord: SavedRecipeRecord | null) => {
      if (pendingRefKeys.has(refKey)) {
        emitOutcome({ status: 'skipped' });
        return;
      }

      if (demoMode) {
        emitOutcome({ status: 'skipped' });
        return;
      }

      const priorRecords = recordsRef.current;
      const removedRecord = nextRecord
        ? null
        : priorRecords.find((row) => row.refKey === refKey) ?? null;

      setPending(refKey, true);

      const finish = (outcome: SavedRecipeToggleOutcome) => {
        setPending(refKey, false);
        emitOutcome(outcome);
      };

      if (isGuest || !userId || !supabase) {
        try {
          if (nextRecord) {
            setRecords(upsertGuestSavedRecipe(nextRecord));
            finish({
              status: 'saved',
              refKey,
            });
          } else {
            setRecords(removeGuestSavedRecipe(refKey));
            finish({
              status: 'removed',
              undo: () => {
                if (removedRecord) void toggleRefKeyRef.current(refKey, removedRecord);
              },
            });
          }
        } catch {
          finish({ status: 'error' });
        }
        return;
      }

      const optimistic = applySavedToggle(priorRecords, refKey, nextRecord);
      setRecords(optimistic);

      persistRef.current += 1;
      const token = persistRef.current;

      try {
        if (nextRecord) {
          await upsertUserSavedRecipe(supabase, userId, nextRecord);
          finish({ status: 'saved', refKey });
        } else {
          await deleteUserSavedRecipe(supabase, userId, refKey);
          finish({
            status: 'removed',
            undo: () => {
              if (removedRecord) void toggleRefKeyRef.current(refKey, removedRecord);
            },
          });
        }
      } catch {
        if (token === persistRef.current) {
          setRecords(priorRecords);
        }
        finish({ status: 'error' });
      }
    },
    [demoMode, emitOutcome, isGuest, pendingRefKeys, setPending, supabase, userId],
  );

  toggleRefKeyRef.current = toggleRefKey;

  const isPendingRefKey = useCallback(
    (refKey: string) => pendingRefKeys.has(refKey),
    [pendingRefKeys],
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

  const isKitchenSavePending = useCallback(
    (recipe: Recipe) => isPendingRefKey(refKeyForKitchenRecipe(recipe)),
    [isPendingRefKey],
  );

  const isCreatorSavePending = useCallback(
    (videoId: string, importedRecipe: Recipe | null) =>
      isPendingRefKey(refKeyForCreatorVideo(videoId, importedRecipe)),
    [isPendingRefKey],
  );

  const toggleKitchenRecipe = useCallback(
    (recipe: Recipe) => {
      const record =
        isMealDbRecipeId(recipe.id) || recipe.sourceType === 'themealdb'
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
    isPendingRefKey,
    isKitchenSavePending,
    isCreatorSavePending,
    toggleKitchenRecipe,
    toggleCreatorVideo,
    toggleViralItem,
    openCreatorFromSaved,
    reload: load,
  };
}
