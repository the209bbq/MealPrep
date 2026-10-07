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
import { buildMyRecipesFeedRows } from '../lib/recipes/viralFeedRows';
import {
  buildSavedRecipeFeedRows,
  savedCreatorItemFromRecord,
} from '../lib/savedRecipes/resolveRows';
import {
  readAccountSavedRecipesCache,
  writeAccountSavedRecipesCache,
} from '../lib/savedRecipes/accountCache';
import {
  readHiddenImportedKitchenIds,
  writeHiddenImportedKitchenIds,
} from '../lib/savedRecipes/hiddenImportedKitchen';
import { isUserImportedKitchenRecipe } from '../lib/recipeImport/mapToAppRecipe';
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

export type SavedRecipesController = ReturnType<typeof useSavedRecipes>;

export function useSavedRecipes(options: {
  session: Session | null;
  /** Signed-in kitchen user id (includes offline cache fallback). */
  accountUserId?: string | null;
  demoMode: boolean;
  isGuest: boolean;
  accountRecipeIds: ReadonlySet<string>;
  kitchenRecipes: readonly Recipe[];
  pantry: PantryItem[];
  pantryMatches: PantryMatchIndex;
  liveDataLoaded?: boolean;
  onToggleOutcome?: (outcome: SavedRecipeToggleOutcome) => void;
}) {
  const {
    session,
    accountUserId = null,
    demoMode,
    isGuest,
    accountRecipeIds,
    kitchenRecipes,
    pantry,
    pantryMatches,
    liveDataLoaded = true,
    onToggleOutcome,
  } = options;
  const userId = session?.user?.id ?? accountUserId;
  const supabase = getSupabase();
  const [records, setRecords] = useState<SavedRecipeRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [hiddenImportedKitchenIds, setHiddenImportedKitchenIds] = useState<Set<string>>(
    () => new Set(),
  );
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
    if (isGuest || !userId) {
      setRecords(readGuestSavedRecipes());
      setHydrated(true);
      return;
    }
    if (!supabase || !session?.user?.id) {
      const cached = readAccountSavedRecipesCache(userId);
      setRecords(cached ?? []);
      setHydrated(true);
      return;
    }
    try {
      const rows = await fetchUserSavedRecipes(supabase, userId);
      setRecords(rows);
      writeAccountSavedRecipesCache(userId, rows);
    } catch {
      const cached = readAccountSavedRecipesCache(userId);
      setRecords(cached ?? []);
    } finally {
      setHydrated(true);
    }
  }, [demoMode, isGuest, session?.user?.id, supabase, userId]);

  useEffect(() => {
    void load();
  }, [load, liveDataLoaded]);

  useEffect(() => {
    if (isGuest || !userId) {
      setHiddenImportedKitchenIds(new Set());
      return;
    }
    setHiddenImportedKitchenIds(readHiddenImportedKitchenIds(userId));
  }, [isGuest, userId]);

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

  const persistAccountCache = useCallback(
    (rows: SavedRecipeRecord[]) => {
      if (!demoMode && !isGuest && userId) {
        writeAccountSavedRecipesCache(userId, rows);
      }
    },
    [demoMode, isGuest, userId],
  );

  const hideImportedKitchenFromHub = useCallback(
    (recipeId: string) => {
      if (isGuest || !userId) return;
      setHiddenImportedKitchenIds((prev) => {
        const next = new Set(prev);
        next.add(recipeId);
        writeHiddenImportedKitchenIds(userId, next);
        return next;
      });
    },
    [isGuest, userId],
  );

  const unhideImportedKitchenFromHub = useCallback(
    (recipeId: string) => {
      if (isGuest || !userId) return;
      setHiddenImportedKitchenIds((prev) => {
        if (!prev.has(recipeId)) return prev;
        const next = new Set(prev);
        next.delete(recipeId);
        writeHiddenImportedKitchenIds(userId, next);
        return next;
      });
    },
    [isGuest, userId],
  );

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
      persistAccountCache(optimistic);

      try {
        if (nextRecord) {
          await upsertUserSavedRecipe(supabase, userId, nextRecord, { accountRecipeIds });
          persistAccountCache(recordsRef.current);
          finish({ status: 'saved', refKey });
        } else {
          await deleteUserSavedRecipe(supabase, userId, refKey);
          persistAccountCache(recordsRef.current);
          finish({
            status: 'removed',
            undo: () => {
              if (removedRecord) void toggleRefKeyRef.current(refKey, removedRecord);
            },
          });
        }
      } catch {
        setRecords((current) => {
          const rolled =
            nextRecord != null
              ? applySavedToggle(current, refKey, null)
              : removedRecord != null
                ? applySavedToggle(current, refKey, removedRecord)
                : current;
          persistAccountCache(rolled);
          return rolled;
        });
        finish({ status: 'error' });
      }
    },
    [accountRecipeIds, demoMode, emitOutcome, isGuest, pendingRefKeys, setPending, supabase, userId],
  );

  toggleRefKeyRef.current = toggleRefKey;

  const isPendingRefKey = useCallback(
    (refKey: string) => pendingRefKeys.has(refKey),
    [pendingRefKeys],
  );

  const isSavedRef = useCallback((refKey: string) => savedKeys.has(refKey), [savedKeys]);

  const isKitchenSaved = useCallback(
    (recipe: Recipe) => {
      if (hiddenImportedKitchenIds.has(recipe.id)) return false;
      const mealdbId = mealDbIdFromKitchenRecipe(recipe);
      if (mealdbId && savedKeys.has(savedRefKeyMealDb(mealdbId))) return true;
      if (savedKeys.has(savedRefKeyKitchen(recipe.id))) return true;
      return isUserImportedKitchenRecipe(recipe);
    },
    [hiddenImportedKitchenIds, savedKeys],
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
      const refKey = refKeyForKitchenRecipe(recipe);
      const hasBookmark = isSavedRef(refKey);
      const importedInHub =
        isUserImportedKitchenRecipe(recipe) && !hiddenImportedKitchenIds.has(recipe.id);
      const saved = hasBookmark || importedInHub;

      if (saved) {
        if (importedInHub) {
          hideImportedKitchenFromHub(recipe.id);
        }
        if (hasBookmark) {
          void toggleRefKey(refKey, null);
          return;
        }
        emitOutcome({
          status: 'removed',
          undo: () => {
            unhideImportedKitchenFromHub(recipe.id);
          },
        });
        return;
      }

      unhideImportedKitchenFromHub(recipe.id);
      const record =
        isMealDbRecipeId(recipe.id) || recipe.sourceType === 'themealdb'
          ? savedRecordFromMealDbRecipe(recipe)
          : savedRecordFromKitchenRecipe(recipe);
      void toggleRefKey(refKey, { ...record, refKey });
    },
    [
      emitOutcome,
      hiddenImportedKitchenIds,
      hideImportedKitchenFromHub,
      isSavedRef,
      toggleRefKey,
      unhideImportedKitchenFromHub,
    ],
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

  const feedRows = useMemo(() => {
    const saved = buildSavedRecipeFeedRows(records, kitchenRecipes, pantry, pantryMatches);
    const imported = buildMyRecipesFeedRows({ kitchenRecipes, pantryMatches });
    const seen = new Set(
      saved.map((row) => (row.kind === 'kitchen' ? row.recipe.id : `api-${row.recipe.id}`)),
    );
    const merged = [...saved];
    for (const row of imported) {
      const id = row.kind === 'kitchen' ? row.recipe.id : `api-${row.recipe.id}`;
      if (seen.has(id)) continue;
      if (row.kind === 'kitchen' && hiddenImportedKitchenIds.has(row.recipe.id)) continue;
      seen.add(id);
      merged.push(row);
    }
    return merged;
  }, [hiddenImportedKitchenIds, kitchenRecipes, pantry, pantryMatches, records]);

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
