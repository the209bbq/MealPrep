import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { RECIPE_IMPORT, RECIPE_IMPORT_COPY } from '../config/recipeImport';
import type { RecipesTabRow } from '../config/recipesTabFilters';
import {
  importRecipeFromLink,
  RecipeImportAuthError,
  RecipeImportUpstreamError,
} from '../lib/recipeImport/client';
import { scoreRecipeAgainstPantry } from '../lib/recipeMatch/match';
import {
  findKitchenRecipeBySourceUrl,
  recipeSourceUrlKey,
} from '../lib/recipes/recipeSourceUrl';
import {
  stubKitchenRecipeFromViralItem,
  viralItemToKitchenRow,
} from '../lib/recipes/viralFeedRows';
import type { PantryMatchIndex } from '../lib/recipeMatch';
import type { PantryItem, Recipe } from '../types/mealprep';
import type { ViralRecipeLinkItem } from '../lib/viralRecipes/types';

export interface ViralRecipeOpenState {
  item: ViralRecipeLinkItem;
  importing: boolean;
  importError: string | null;
  row: RecipesTabRow;
}

export function useViralRecipeOpen(options: {
  session: Session | null;
  demoMode: boolean;
  kitchenRecipes: Recipe[];
  pantry: PantryItem[];
  pantryMatches: PantryMatchIndex;
  saveImported: (extracted: import('../lib/recipeImport/types').RecipeImportExtractedDto) => Promise<Recipe>;
  openAuthSheet: () => void;
}) {
  const { session, demoMode, kitchenRecipes, pantry, pantryMatches, saveImported, openAuthSheet } =
    options;
  const [openState, setOpenState] = useState<ViralRecipeOpenState | null>(null);
  const inFlightKeys = useRef(new Set<string>());

  const resolveRowForItem = useCallback(
    (item: ViralRecipeLinkItem): RecipesTabRow | null => {
      const existing = findKitchenRecipeBySourceUrl(kitchenRecipes, item.watchUrl);
      if (!existing) return null;
      const match =
        pantryMatches.byRecipeId.get(existing.id) ?? {
          recipeId: existing.id,
          recipeName: existing.name,
          totalIngredients: existing.ingredients.length,
          matchedCount: 0,
          missingCount: existing.ingredients.length,
          percentMatch: 0,
          matched: [],
          missing: existing.ingredients,
        };
      return viralItemToKitchenRow(item, existing, match);
    },
    [kitchenRecipes, pantryMatches],
  );

  const runImport = useCallback(
    async (item: ViralRecipeLinkItem) => {
      const key = recipeSourceUrlKey(item.watchUrl);
      if (inFlightKeys.current.has(key)) return;
      inFlightKeys.current.add(key);

      setOpenState((prev) =>
        prev?.item.videoId === item.videoId
          ? { ...prev, importing: true, importError: null }
          : prev,
      );

      try {
        if (!session && !demoMode) {
          setOpenState((prev) =>
            prev?.item.videoId === item.videoId
              ? {
                  ...prev,
                  importing: false,
                  importError: RECIPE_IMPORT_COPY.guestSignInMessage,
                }
              : prev,
          );
          return;
        }
        const token = session?.access_token ?? null;
        const extracted = await importRecipeFromLink(item.watchUrl, token);
        const saved = await saveImported(extracted);
        const match = scoreRecipeAgainstPantry(saved, pantry);
        setOpenState({
          item,
          importing: false,
          importError: null,
          row: viralItemToKitchenRow(item, saved, match),
        });
      } catch (err) {
        let message: string = RECIPE_IMPORT.importFailedMessage;
        if (err instanceof RecipeImportAuthError) {
          message = RECIPE_IMPORT_COPY.guestSignInMessage;
        } else if (err instanceof RecipeImportUpstreamError) {
          message = err.message;
        } else if (err instanceof Error) {
          message = err.message;
        }
        setOpenState((prev) =>
          prev?.item.videoId === item.videoId
            ? { ...prev, importing: false, importError: message }
            : prev,
        );
      } finally {
        inFlightKeys.current.delete(key);
      }
    },
    [demoMode, pantry, saveImported, session],
  );

  const openViralItem = useCallback(
    (item: ViralRecipeLinkItem) => {
      const existingRow = resolveRowForItem(item);
      if (existingRow) {
        setOpenState({
          item,
          importing: false,
          importError: null,
          row: existingRow,
        });
        return;
      }

      const stub = stubKitchenRecipeFromViralItem(item);
      const stubMatch = {
        recipeId: stub.id,
        recipeName: stub.name,
        totalIngredients: 0,
        matchedCount: 0,
        missingCount: 0,
        percentMatch: 0,
        matched: [],
        missing: [],
      };
      setOpenState({
        item,
        importing: true,
        importError: null,
        row: viralItemToKitchenRow(item, stub, stubMatch),
      });
      void runImport(item);
    },
    [resolveRowForItem, runImport],
  );

  const closeViral = useCallback(() => setOpenState(null), []);

  const retryImport = useCallback(() => {
    if (!openState) return;
    void runImport(openState.item);
  }, [openState, runImport]);

  useEffect(() => {
    if (!openState || openState.importing) return;
    const synced = resolveRowForItem(openState.item);
    if (!synced) return;
    const recipeChanged = synced.recipe.id !== openState.row.recipe.id;
    const matchChanged =
      synced.match.missingCount !== openState.row.match.missingCount ||
      synced.match.totalIngredients !== openState.row.match.totalIngredients;
    if (recipeChanged || matchChanged) {
      setOpenState((prev) =>
        prev?.item.videoId === openState.item.videoId
          ? { ...prev, row: synced, importError: null }
          : prev,
      );
    }
  }, [kitchenRecipes, openState, pantryMatches, resolveRowForItem]);

  return {
    viralOpenState: openState,
    openViralItem,
    closeViral,
    retryImport,
    openAuthSheet,
  };
}
