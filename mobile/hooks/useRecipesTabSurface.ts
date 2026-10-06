import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecipesTabVisitSession } from '../lib/recipesTab/useVisitSessionOnFocus';
import type { MealDbCatalogCategory } from '../config/recipesTabSurface';
import type { CreatorListItem } from '../lib/creatorVideos/types';
import type { CreatorVideoItem } from '../lib/creatorVideos/types';
import type { UserDietPrefs } from '../lib/diet/types';
import { passRateByCreatorId, groupVideosByChannelId } from '../lib/recipesTab/creatorPassRate';
import {
  buildCreatorRotation,
  first5CreatorIds,
  type CreatorRotationSlot,
} from '../lib/recipesTab/creatorRotation';
import {
  buildCategoryRotation,
  first3CategoryNames,
  type MealDbCategoryChip,
} from '../lib/recipesTab/categoryRotation';
import { buildRefKeyToCreatorIdMap } from '../lib/recipesTab/refKeyCreatorMap';
import type { RecipesTabSectionExpanded } from '../lib/recipesTab/sectionExpanded';
import {
  appendRecipesTabSurfaceEvent,
  readRecipesTabSurfaceEvents,
  type CreatorSlotType,
  type RecipesTabSurfaceEvent,
} from '../lib/recipesTab/surfaceEvents';
import {
  commitVisitRowOrder,
  type RecipesTabVisitState,
} from '../lib/recipesTab/visitState';
import type { EngagementIndexV2 } from '../lib/recipeRanking/engagementIndex';
import type { RecipeEngagementEvent } from '../lib/recipeRanking/types';
import type { MealDbCategoryMeta } from '../lib/mealdb/categories';

export function useRecipesTabSurface(options: {
  ownerId: string;
  enabled: boolean;
  creators: readonly CreatorListItem[];
  feedVideos: readonly CreatorVideoItem[];
  categoryMeta: readonly MealDbCategoryMeta[];
  categoryPassCounts: ReadonlyMap<MealDbCatalogCategory, number>;
  dietPrefs: UserDietPrefs;
  householdSize: number;
  engagementIndex: EngagementIndexV2;
  recipeEvents: readonly RecipeEngagementEvent[];
  sectionsExpanded: RecipesTabSectionExpanded;
  onSectionsExpandedChange: (next: RecipesTabSectionExpanded) => void;
  /** Increment to reshuffle creator/category bubbles (manual refresh). */
  manualRotationEpoch?: number;
}) {
  const {
    ownerId,
    enabled,
    creators,
    feedVideos,
    categoryMeta,
    categoryPassCounts,
    dietPrefs,
    householdSize,
    engagementIndex,
    recipeEvents,
    sectionsExpanded: sections,
    onSectionsExpandedChange,
    manualRotationEpoch,
  } = options;
  const [surfaceEvents, setSurfaceEvents] = useState<RecipesTabSurfaceEvent[]>(() =>
    readRecipesTabSurfaceEvents(ownerId),
  );
  const committedVisitRef = useRef<string | null>(null);
  const visitStateForRotationRef = useRef<RecipesTabVisitState | null>(null);
  const impressedCreatorsRef = useRef<Set<string>>(new Set());
  const impressedCategoriesRef = useRef<Set<string>>(new Set());

  const { visitSession, visitEpoch } = useRecipesTabVisitSession(ownerId, enabled, {
    manualRotationEpoch,
  });

  useEffect(() => {
    visitStateForRotationRef.current = visitSession?.state ?? null;
  }, [visitSession]);

  useEffect(() => {
    committedVisitRef.current = null;
    impressedCreatorsRef.current = new Set();
    impressedCategoriesRef.current = new Set();
  }, [ownerId, visitEpoch]);

  const visitId = visitSession?.visitId ?? 'disabled';

  const refKeyToCreatorId = useMemo(
    () => buildRefKeyToCreatorIdMap(creators, feedVideos),
    [creators, feedVideos],
  );

  const passRates = useMemo(() => {
    const byChannel = groupVideosByChannelId(feedVideos);
    return passRateByCreatorId(creators, byChannel, dietPrefs);
  }, [creators, dietPrefs, feedVideos]);

  const creatorSlots: CreatorRotationSlot[] = useMemo(() => {
    if (!enabled || !visitSession || creators.length === 0) return [];
    return buildCreatorRotation({
      visitId: visitSession.visitId,
      creators,
      passRateById: passRates,
      recipeEvents,
      surfaceEvents,
      refKeyToCreatorId,
      visitState: visitStateForRotationRef.current ?? visitSession.state,
      nowMs: Date.now(),
    });
  }, [
    creators,
    enabled,
    passRates,
    recipeEvents,
    refKeyToCreatorId,
    surfaceEvents,
    visitSession,
    visitEpoch,
  ]);

  const categoryChips: MealDbCategoryChip[] = useMemo(() => {
    if (!enabled || !visitSession || categoryMeta.length === 0) return [];
    const categories = categoryMeta.map((row) => ({
      category: row.category,
      thumbUrl: row.thumbUrl,
      passingRecipeCount: categoryPassCounts.get(row.category) ?? 0,
    }));
    return buildCategoryRotation({
      visitId: visitSession.visitId,
      categories,
      prefs: dietPrefs,
      householdSize,
      index: engagementIndex,
      surfaceEvents,
      visitState: visitStateForRotationRef.current ?? visitSession.state,
      nowMs: Date.now(),
    });
  }, [
    categoryMeta,
    categoryPassCounts,
    dietPrefs,
    enabled,
    engagementIndex,
    householdSize,
    surfaceEvents,
    visitSession,
    visitEpoch,
  ]);

  useEffect(() => {
    if (!enabled || !visitSession || visitSession.isNewVisit === false) return;
    if (committedVisitRef.current === visitSession.visitId) return;
    if (creatorSlots.length === 0 && categoryChips.length === 0) return;
    committedVisitRef.current = visitSession.visitId;
    const nextState = commitVisitRowOrder(
      ownerId,
      visitSession.state,
      first5CreatorIds(creatorSlots),
      first3CategoryNames(categoryChips),
    );
    visitStateForRotationRef.current = nextState;
  }, [categoryChips, creatorSlots, enabled, ownerId, visitSession]);

  const setClassicExpanded = useCallback(
    (expanded: boolean) => {
      onSectionsExpandedChange({ ...sections, classic: expanded });
    },
    [onSectionsExpandedChange, sections],
  );

  const setCreatorsExpanded = useCallback(
    (expanded: boolean) => {
      onSectionsExpandedChange({ ...sections, creators: expanded });
    },
    [onSectionsExpandedChange, sections],
  );

  const logSurfaceEvent = useCallback(
    (event: RecipesTabSurfaceEvent) => {
      const next = appendRecipesTabSurfaceEvent(ownerId, event, surfaceEvents);
      setSurfaceEvents(next);
    },
    [ownerId, surfaceEvents],
  );

  const logCreatorImpression = useCallback(
    (creatorId: string, position: number, slotType: CreatorSlotType) => {
      if (impressedCreatorsRef.current.has(creatorId)) return;
      impressedCreatorsRef.current.add(creatorId);
      logSurfaceEvent({
        type: 'creator_impression',
        ts: Date.now(),
        visitId,
        creatorId,
        position,
        slotType,
      });
    },
    [logSurfaceEvent, visitId],
  );

  const logCreatorOpen = useCallback(
    (creatorId: string, position: number, slotType: CreatorSlotType) => {
      logSurfaceEvent({
        type: 'creator_open',
        ts: Date.now(),
        visitId,
        creatorId,
        position,
        slotType,
      });
    },
    [logSurfaceEvent, visitId],
  );

  const logCategoryImpression = useCallback(
    (category: string, position: number) => {
      if (impressedCategoriesRef.current.has(category)) return;
      impressedCategoriesRef.current.add(category);
      logSurfaceEvent({
        type: 'category_impression',
        ts: Date.now(),
        visitId,
        category,
        position,
      });
    },
    [logSurfaceEvent, visitId],
  );

  const logCategoryOpen = useCallback(
    (category: string, position: number) => {
      logSurfaceEvent({
        type: 'category_open',
        ts: Date.now(),
        visitId,
        category,
        position,
      });
    },
    [logSurfaceEvent, visitId],
  );

  return {
    visitId,
    sections,
    setClassicExpanded,
    setCreatorsExpanded,
    creatorSlots,
    categoryChips,
    logCreatorImpression,
    logCreatorOpen,
    logCategoryImpression,
    logCategoryOpen,
    surfaceEvents,
  };
}
