import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHydrated } from './useHydrated';
import type { RecipesTabFilterState } from '../config/recipesTabFilters';
import type { UserDietPrefs } from '../lib/diet/types';
import type { RecipeCostPricingContext } from '../lib/costPerServing/types';
import {
  appendRecipeEngagementEvent,
  clearWontCookForRef,
  createEngagementEvent,
  createSeamlessEngagementEvent,
  personalSignalsReady,
  rankCreatorFeedModels,
  rankRecipeSearchResults,
  rankRecipesTabRows,
  readEngagementIndexForOwner,
  readRecipeEngagementEvents,
  shouldLogImpression,
  wontCookRefKeys,
  type RecipeEngagementEvent,
  type RecipeEngagementEventType,
  type RecipeEngagementEventV2,
  type RecipeRankingContext,
} from '../lib/recipeRanking';
import { recipeCategoryGroup } from '../lib/seamlessFlow/categoryGroup';
import { refKeyForKitchenRecipe } from '../lib/savedRecipes/refKey';
import type { Recipe } from '../types/mealprep';

export function useRecipeRanking(options: {
  ownerId: string;
  dietPrefs: UserDietPrefs;
  householdSize: number;
  tabFilters: RecipesTabFilterState;
  pricing: RecipeCostPricingContext;
}) {
  const { ownerId, dietPrefs, householdSize, tabFilters, pricing } = options;
  const hydrated = useHydrated();
  const [events, setEvents] = useState<RecipeEngagementEvent[]>([]);
  const [engagementIndex, setEngagementIndex] = useState(() => readEngagementIndexForOwner(''));

  useEffect(() => {
    if (!hydrated) return;
    setEvents(readRecipeEngagementEvents(ownerId));
    setEngagementIndex(readEngagementIndexForOwner(ownerId));
  }, [hydrated, ownerId]);

  const reloadEvents = useCallback(() => {
    setEvents(readRecipeEngagementEvents(ownerId));
    setEngagementIndex(readEngagementIndexForOwner(ownerId));
  }, [ownerId]);

  const rankingContext = useMemo((): RecipeRankingContext => {
    return {
      dietPrefs,
      householdSize,
      tabFilters,
      events,
      pricing,
      engagementIndex,
      personalSignalsReady: personalSignalsReady(events),
    };
  }, [dietPrefs, engagementIndex, events, householdSize, pricing, tabFilters]);

  const logEvent = useCallback(
    (refKey: string, type: RecipeEngagementEventType) => {
      const trimmed = refKey.trim();
      if (!trimmed) return;
      const next = appendRecipeEngagementEvent(
        ownerId,
        createEngagementEvent(trimmed, type),
        events,
      );
      setEvents(next);
      setEngagementIndex(readEngagementIndexForOwner(ownerId));
    },
    [events, ownerId],
  );

  const logImpression = useCallback(
    (refKey: string) => {
      const trimmed = refKey.trim();
      if (!trimmed) return;
      if (!shouldLogImpression(trimmed, events)) return;
      logEvent(trimmed, 'impression');
    },
    [events, logEvent],
  );

  const logOpen = useCallback((refKey: string) => logEvent(refKey, 'open'), [logEvent]);
  const logCook = useCallback((refKey: string) => logEvent(refKey, 'cook_confirmed'), [logEvent]);
  const logSave = useCallback((refKey: string) => logEvent(refKey, 'save'), [logEvent]);
  const logSkip = useCallback((refKey: string) => logEvent(refKey, 'skip'), [logEvent]);

  const logSeamlessEvent = useCallback(
    (
      refKey: string,
      type: Extract<
        RecipeEngagementEventType,
        | 'plan'
        | 'cook_now'
        | 'just_save'
        | 'skip'
        | 'import'
        | 'ghost_confirm'
        | 'ghost_override'
        | 'cook_confirmed'
        | 'cook_declined'
      >,
      v2: RecipeEngagementEventV2,
    ) => {
      const trimmed = refKey.trim();
      if (!trimmed) return;
      const next = appendRecipeEngagementEvent(
        ownerId,
        createSeamlessEngagementEvent(trimmed, type, v2),
        events,
      );
      setEvents(next);
      setEngagementIndex(readEngagementIndexForOwner(ownerId));
    },
    [events, ownerId],
  );

  const logImport = useCallback(
    (recipe: Recipe, tags: string[] = []) => {
      const refKey = refKeyForKitchenRecipe(recipe);
      const group = recipeCategoryGroup({
        category: recipe.tag,
        title: recipe.name,
        tags,
      });
      logSeamlessEvent(refKey, 'import', {
        ts: Date.now(),
        recipeId: recipe.id,
        source: 'import',
        group,
        sheetId: `import-${recipe.id}`,
        tags,
      });
    },
    [logSeamlessEvent],
  );

  const markWontCook = useCallback(
    (refKey: string) => {
      logEvent(refKey, 'wont_cook');
    },
    [logEvent],
  );

  const undoWontCook = useCallback(
    (refKey: string) => {
      const next = clearWontCookForRef(ownerId, refKey, events);
      setEvents(next);
      setEngagementIndex(readEngagementIndexForOwner(ownerId));
    },
    [events, ownerId],
  );

  const isWontCook = useCallback(
    (refKey: string) => wontCookRefKeys(events).has(refKey),
    [events],
  );

  const rankTabRows = useCallback(
    (rows: Parameters<typeof rankRecipesTabRows>[0]) => rankRecipesTabRows(rows, rankingContext),
    [rankingContext],
  );

  const rankCreatorModels = useCallback(
    (models: Parameters<typeof rankCreatorFeedModels>[0]) =>
      rankCreatorFeedModels(models, rankingContext),
    [rankingContext],
  );

  const rankSearchResults = useCallback(
    (
      items: Parameters<typeof rankRecipeSearchResults>[0],
      searchQuery?: string,
    ) => rankRecipeSearchResults(items, rankingContext, undefined, searchQuery),
    [rankingContext],
  );

  return {
    events,
    engagementIndex,
    reloadEvents,
    rankingContext,
    logImpression,
    logOpen,
    logCook,
    logSave,
    logSkip,
    logSeamlessEvent,
    logImport,
    markWontCook,
    undoWontCook,
    isWontCook,
    rankTabRows,
    rankCreatorModels,
    rankSearchResults,
  };
}
