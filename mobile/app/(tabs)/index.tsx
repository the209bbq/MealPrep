import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { GuestSaveNudge } from '../../components/GuestSaveNudge';
import { InstallAppBanner } from '../../components/InstallAppBanner';
import { CookConfirmBanner } from '../../components/home/CookConfirmBanner';
import { HomeRecipesRefreshButton } from '../../components/home/HomeRecipesRefreshButton';
import { HomePantryCta } from '../../components/home/HomePantryCta';
import { HomeHubSheet } from '../../components/home/HomeHubSheet';
import { Card } from '../../components/Card';
import { RecipeDetailSheet } from '../../components/recipes/RecipeDetailSheet';
import { CreatorAvatarsRow } from '../../components/recipes/CreatorAvatarsRow';
import { CreatorRecipeWebsiteLink } from '../../components/recipes/CreatorRecipeWebsiteLink';
import { CategoryAvatarsRow } from '../../components/recipes/CategoryAvatarsRow';
import { RecipesTabCollapsibleSection } from '../../components/recipes/RecipesTabCollapsibleSection';
import { CreatorRecipesFeedCard } from '../../components/recipes/CreatorRecipesFeedCard';
import { CreatorRecipesFeedModeDropdown } from '../../components/recipes/CreatorRecipesFeedModeDropdown';
import { RecipesFeedCardSkeleton } from '../../components/recipes/RecipesFeedCardSkeleton';
import { RecipesUnifiedFeedCard } from '../../components/recipes/RecipesUnifiedFeedCard';
import { RecipesTabFilterBar, RecipesTabFiltersEmptyState } from '../../components/RecipesTabFilterBar';
import { RECIPES_COPY } from '../../config/recipesCopy';
import { THEME, isCreatorRecipesConfigured } from '../../config/appConfig';
import {
  applyRecipesTabFilters,
  recipesTabNarrowingFiltersActive,
  type RecipesTabRow,
} from '../../config/recipesTabFilters';
import {
  CREATOR_RECIPES_COPY,
  type CreatorRecipesBrowseMode,
  type CreatorRecipesFeedMode,
} from '../../config/creatorRecipes';
import { useRecipesTabFilters } from '../../hooks/useRecipesTabFilters';
import { useCreatorChannelVideos, useCreatorFeed, useCreatorList } from '../../hooks/useCreatorRecipes';
import { useUnifiedRecipeSearch } from '../../hooks/useUnifiedRecipeSearch';
import { useViralRecipeOpen } from '../../hooks/useViralRecipeOpen';
import { useApp } from '../../context/AppContext';
import { buildRecipesTabCatalogRows } from '../../lib/recipes/recipesTabCatalog';
import { buildUnifiedRecipesFeed } from '../../lib/recipes/unifiedFeed';
import {
  filterCreatorFeedModelsForDietPrefs,
  filterRecipeSearchResultsForDietPrefs,
  filterRecipesTabRowsForDietPrefs,
} from '../../lib/diet/filterRows';
import { buildCreatorFeedCardModels } from '../../lib/recipes/creatorFeedRows';
import { findKitchenRecipeBySourceUrl } from '../../lib/recipes/recipeSourceUrl';
import type { SavedRecipeToggleOutcome } from '../../hooks/useSavedRecipes';
import { useHomeHubSheet } from '../../context/HomeHubSheetContext';
import { savedCreatorItemFromRecord } from '../../lib/savedRecipes/resolveRows';
import { RECIPE_SOURCES } from '../../config/recipeSources';
import { MEALDB_COPY } from '../../config/mealdb';
import { RECIPES_TAB_SURFACE_COPY } from '../../config/recipesTabSurface';
import type { MealDbCatalogCategory } from '../../config/recipesTabSurface';
import { useRecipesTabSurface } from '../../hooks/useRecipesTabSurface';
import {
  defaultRecipesTabSectionExpanded,
  type RecipesTabSectionExpanded,
} from '../../lib/recipesTab/sectionExpanded';
import {
  mealDbListCategories,
  countPassingRecipesForCategoryFromRows,
} from '../../lib/mealdb/categories';
import { useClassicCategoryFeed } from '../../hooks/useClassicCategoryFeed';
import { userNeedsResolvedMealDbRowsBeforeDisplay } from '../../lib/diet/stubSafety';
import { wontCookRefKeys } from '../../lib/recipeRanking/hardFilter';
import type { CreatorRotationSlot } from '../../lib/recipesTab/creatorRotation';
import type { MealDbCategoryChip } from '../../lib/recipesTab/categoryRotation';
import { useMealDbRecipes } from '../../hooks/useMealDbRecipes';
import { useHomeRecipePrefetch } from '../../hooks/useHomeRecipePrefetch';
import { useHomeRecipesRefresh } from '../../hooks/useHomeRecipesRefresh';
import {
  HomeWebPullRefreshIndicator,
  useHomeScrollRefresh,
} from '../../hooks/useHomeScrollRefresh';
import { prefetchMealDbCategoryOnIntent } from '../../lib/mealdb/homePrefetch';
import { clearMealDbCategoryFeedSnapshot } from '../../lib/mealdb/categoryFeedCache';
import {
  kitchenRowFailsDietPrefs,
  resolveKitchenRecipesTabRowDetails,
} from '../../lib/mealdb/resolveKitchenRowDetails';
import { RecipeImportFromShareParams } from '../../components/recipes/RecipeImportFromLink';
import { RECIPE_IMPORT_COPY } from '../../config/recipeImport';
import type { CreatorListItem } from '../../lib/creatorVideos/types';
import { creatorWebsiteForChannel } from '../../config/creatorWebsites';
import type { RecipeDiscoveryListItem } from '../../lib/recipeDiscovery/types';
import { GUEST_OWNER_ID } from '../../config/guestMode';
import { isOffline } from '../../lib/network/isOffline';
import { useRecipeRanking } from '../../hooks/useRecipeRanking';
import {
  refKeyFromCreatorModel,
  refKeyFromRecipesTabRow,
} from '../../lib/recipeRanking/recipeInputs';
import { useScheduleRecipeSheet } from '../../context/ScheduleRecipeSheetContext';
import {
  scheduleTargetFromCreatorModel,
  scheduleTargetFromRecipesTabRow,
} from '../../lib/mealCalendar/scheduleTarget';
import type { CreatorFeedCardModel } from '../../lib/recipes/creatorFeedRows';
import { sourceTagForRecipesTabRow } from '../../lib/recipes/searchResultSourceTag';

function RecipesFeedSectionLabel({ title, className }: { title: string; className?: string }) {
  return (
    <Text
      accessibilityRole="header"
      className={`text-xs font-bold uppercase tracking-wide text-muted ${className ?? 'mb-2 mt-4'}`}
    >
      {title}
    </Text>
  );
}

export default function HomeScreen() {
  const params = useLocalSearchParams<{
    recipeId?: string;
    url?: string;
    text?: string;
    import?: string;
    search?: string;
  }>();
  const {
    pantry,
    session,
    demoMode,
    openAuthSheet,
    saveLinkImportedRecipe,
    clearImportedRecipeSource,
    pantryRecipeMatches,
    addMissingRecipeIngredientsToGrocery,
    addMissingDiscoveryRecipeIngredientsToGrocery,
    toggleMealPlanDiscoveryRecipe,
    isOnMealPlan,
    toggleMealPlanKitchenRecipe,
    feedKitchenRecipes,
    isGuest,
    userDietPrefs,
    notifySavedToMyRecipes,
    notifyRemovedFromMyRecipes,
    notifyMyRecipesSaveFailed,
    notifyRecipeHiddenForDietSettings,
    notifyRecipeOfflineUnavailable,
    profile,
    savedRecipes,
    registerSavedRecipeToggleOutcome,
    finishCookViewSession,
    cookConfirmPrompt,
    confirmCookConfirmPrompt,
    declineCookConfirmPrompt,
    dismissCookConfirmPrompt,
    cookConfirmBusy,
  } = useApp();
  const { openHub } = useHomeHubSheet();
  const ownerId =
    session?.user?.id ?? (demoMode ? profile.id || 'demo-user' : GUEST_OWNER_ID);
  const routeRecipeId =
    typeof params.recipeId === 'string' && params.recipeId ? params.recipeId : null;
  const [pickedDetailRow, setPickedDetailRow] = useState<RecipesTabRow | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedMode, setFeedMode] = useState<CreatorRecipesFeedMode>('popular');
  const [selectedCreator, setSelectedCreator] = useState<CreatorListItem | null>(null);
  const [selectedClassicCategory, setSelectedClassicCategory] = useState<MealDbCatalogCategory | null>(
    null,
  );
  const [mealDbCategoryMeta, setMealDbCategoryMeta] = useState<
    Awaited<ReturnType<typeof mealDbListCategories>>
  >([]);
  const [mealDbCategoriesLoading, setMealDbCategoriesLoading] = useState(false);
  const [sectionsExpanded, setSectionsExpanded] = useState<RecipesTabSectionExpanded>(() =>
    defaultRecipesTabSectionExpanded(),
  );

  const handleFeedModeChange = useCallback((mode: CreatorRecipesFeedMode) => {
    setFeedMode(mode);
  }, []);

  const handleSelectCreator = useCallback((creator: CreatorListItem) => {
    setSelectedCreator(creator);
  }, []);

  const creatorFeedEnabled =
    RECIPE_SOURCES.creatorRecipesPrimaryFeed && isCreatorRecipesConfigured();
  const browseMode: CreatorRecipesBrowseMode = feedMode;
  const searchTrimmed = searchQuery.trim();
  const searchTyping = searchTrimmed.length === 1;
  const searching = searchTrimmed.length >= 2;
  const showCreatorCatalogSections = creatorFeedEnabled && !searching;
  const [detailInitialSection, setDetailInitialSection] = useState<'ingredients' | 'steps'>('ingredients');
  const { openScheduleRecipe } = useScheduleRecipeSheet();
  const [feedDiversitySeed, setFeedDiversitySeed] = useState(0);
  const [manualRotationEpoch, setManualRotationEpoch] = useState(0);
  const [classicCategoryRefreshSeed, setClassicCategoryRefreshSeed] = useState(0);
  const [homeMetaRefreshSeed, setHomeMetaRefreshSeed] = useState(0);
  const [rowDetailLoadingId, setRowDetailLoadingId] = useState<string | null>(null);
  const { filters, setFilter, clearAllFilters } = useRecipesTabFilters();
  const recipeRanking = useRecipeRanking({
    ownerId,
    dietPrefs: userDietPrefs,
    householdSize: profile.householdSize,
    tabFilters: filters,
    pricing: { ownerId, communityDeals: [] },
  });
  const {
    logImpression,
    logOpen,
    logCook,
    logSave,
    rankTabRows,
    rankCreatorModels,
    rankSearchResults,
    markWontCook,
    undoWontCook,
    isWontCook,
  } = recipeRanking;

  const handleSavedRecipeToggleOutcome = useCallback(
    (outcome: SavedRecipeToggleOutcome) => {
      if (outcome.status === 'saved') {
        logSave(outcome.refKey);
        notifySavedToMyRecipes(() => openHub('myRecipes'));
      } else if (outcome.status === 'removed') {
        notifyRemovedFromMyRecipes(outcome.undo);
      } else if (outcome.status === 'error') {
        notifyMyRecipesSaveFailed();
      }
    },
    [logSave, notifyMyRecipesSaveFailed, notifyRemovedFromMyRecipes, notifySavedToMyRecipes, openHub],
  );

  useEffect(() => {
    registerSavedRecipeToggleOutcome(handleSavedRecipeToggleOutcome);
    return () => registerSavedRecipeToggleOutcome(null);
  }, [handleSavedRecipeToggleOutcome, registerSavedRecipeToggleOutcome]);

  const creatorsCatalogEnabled =
    creatorFeedEnabled && !searching && !selectedCreator;

  const {
    creators,
    loading: creatorsLoading,
    error: creatorsError,
    refresh: refreshCreators,
  } = useCreatorList(session, {
    enabled: creatorsCatalogEnabled,
  });

  const {
    videos: feedVideos,
    loading: feedLoading,
    error: feedError,
    refresh: refreshCreatorFeed,
  } = useCreatorFeed(
    session,
    browseMode,
    {
      enabled:
        creatorFeedEnabled &&
        !searching &&
        !selectedCreator &&
        sectionsExpanded.creators,
    },
  );

  const {
    creator: channelCreator,
    videos: channelVideos,
    loading: channelLoading,
    error: channelError,
    refresh: refreshCreatorChannel,
  } = useCreatorChannelVideos(session, selectedCreator?.youtubeChannelId ?? null, {
    enabled: creatorFeedEnabled && Boolean(selectedCreator) && !searching,
  });

  const {
    rows: mealDbRows,
    loading: mealDbLoading,
    loadingMore: mealDbLoadingMore,
    error: mealDbError,
    refreshMealDb,
  } = useMealDbRecipes(pantry, {
    enabled: showCreatorCatalogSections && sectionsExpanded.classic,
  });

  const categoryPassCounts = useMemo(() => {
    const wont = wontCookRefKeys(recipeRanking.events);
    const map = new Map<MealDbCatalogCategory, number>();
    for (const meta of mealDbCategoryMeta) {
      map.set(
        meta.category,
        countPassingRecipesForCategoryFromRows(meta.category, mealDbRows, userDietPrefs, wont),
      );
    }
    return map;
  }, [mealDbCategoryMeta, mealDbRows, recipeRanking.events, userDietPrefs]);

  const tabSurface = useRecipesTabSurface({
    ownerId,
    enabled: showCreatorCatalogSections,
    creators,
    feedVideos,
    categoryMeta: mealDbCategoryMeta,
    categoryPassCounts,
    dietPrefs: userDietPrefs,
    householdSize: profile.householdSize,
    engagementIndex: recipeRanking.engagementIndex,
    recipeEvents: recipeRanking.events,
    sectionsExpanded,
    onSectionsExpandedChange: setSectionsExpanded,
    manualRotationEpoch,
  });

  const creatorBubbleChannelIds = useMemo(
    () => tabSurface.creatorSlots.map((slot) => slot.creator.youtubeChannelId),
    [tabSurface.creatorSlots],
  );

  useHomeRecipePrefetch({
    enabled: showCreatorCatalogSections,
    pantry,
    session,
    creatorChannelIds: creatorBubbleChannelIds,
  });

  const handleClassicCatalogRefresh = useCallback(() => {
    setFeedDiversitySeed((value) => value + 1);
    setHomeMetaRefreshSeed((value) => value + 1);
    refreshMealDb();
  }, [refreshMealDb]);

  const handleCreatorsDataRefresh = useCallback(() => {
    void refreshCreators();
    void refreshCreatorFeed();
    if (selectedCreator) {
      void refreshCreatorChannel();
    }
  }, [refreshCreatorChannel, refreshCreatorFeed, refreshCreators, selectedCreator]);

  const handleCategoryReselectRefresh = useCallback(() => {
    if (!selectedClassicCategory) return;
    clearMealDbCategoryFeedSnapshot(selectedClassicCategory, pantry);
    setClassicCategoryRefreshSeed((value) => value + 1);
  }, [pantry, selectedClassicCategory]);

  const homeRecipesRefresh = useHomeRecipesRefresh({
    enabled: showCreatorCatalogSections && !searching,
    pantry,
    session,
    creatorChannelIds: creatorBubbleChannelIds,
    onRotationBump: () => setManualRotationEpoch((value) => value + 1),
    onClassicCatalogRefresh: handleClassicCatalogRefresh,
    onCreatorsRefresh: handleCreatorsDataRefresh,
    onCategoryReselect: handleCategoryReselectRefresh,
  });

  const homeScrollRefresh = useHomeScrollRefresh({
    enabled: showCreatorCatalogSections && !searching,
    refreshing: homeRecipesRefresh.refreshing,
    onRefresh: homeRecipesRefresh.onRefresh,
  });

  useEffect(() => {
    if (!showCreatorCatalogSections) return;
    let cancelled = false;
    setMealDbCategoriesLoading(true);
    void mealDbListCategories()
      .then((rows) => {
        if (!cancelled) setMealDbCategoryMeta(rows);
      })
      .finally(() => {
        if (!cancelled) setMealDbCategoriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [homeMetaRefreshSeed, showCreatorCatalogSections]);

  const classicCategoryFeed = useClassicCategoryFeed(
    selectedClassicCategory,
    pantry,
    classicCategoryRefreshSeed,
  );
  const classicCategoryRows = classicCategoryFeed.rows;
  const classicCategoryLoading = classicCategoryFeed.loading;
  const maskClassicStubTitles = userNeedsResolvedMealDbRowsBeforeDisplay(userDietPrefs);

  const {
    viralOpenState,
    openViralItem,
    closeViral,
    retryImport,
    startImport,
  } = useViralRecipeOpen({
    session,
    demoMode,
    kitchenRecipes: feedKitchenRecipes,
    pantry,
    pantryMatches: pantryRecipeMatches,
    saveImported: saveLinkImportedRecipe,
    openAuthSheet,
  });

  const sharedImportText = useMemo(() => {
    const direct = typeof params.url === 'string' ? params.url.trim() : '';
    if (direct) return direct;
    const text = typeof params.text === 'string' ? params.text : '';
    if (text.trim()) return text.trim();
    return '';
  }, [params.text, params.url]);
  const autoStartSharedImport = useMemo(
    () => Boolean(sharedImportText.trim()) && params.import === '1',
    [params.import, sharedImportText],
  );

  const pantryEmpty = pantry.length === 0;

  const homeSearchParam = typeof params.search === 'string' ? params.search.trim() : '';
  useEffect(() => {
    if (!homeSearchParam) return;
    setSearchQuery(homeSearchParam);
  }, [homeSearchParam]);

  const kitchenRecipes = useMemo(() => feedKitchenRecipes, [feedKitchenRecipes]);

  const filterBaseRows = useMemo((): RecipesTabRow[] => {
    return buildRecipesTabCatalogRows({
      kitchenRecipes,
      pantryMatches: pantryRecipeMatches,
      discoverySuggestions: [],
    });
  }, [kitchenRecipes, pantryRecipeMatches]);

  const filteredRows = useMemo(() => {
    const narrowed = applyRecipesTabFilters(filterBaseRows, filters);
    const fed = buildUnifiedRecipesFeed(narrowed, searchQuery, { diversitySeed: feedDiversitySeed });
    const diet = filterRecipesTabRowsForDietPrefs(fed, userDietPrefs);
    return rankTabRows(diet);
  }, [filterBaseRows, filters, searchQuery, feedDiversitySeed, userDietPrefs, rankTabRows]);

  const classicRecipeRows = useMemo(() => {
    if (!showCreatorCatalogSections) return [];
    const source = selectedClassicCategory ? classicCategoryRows : mealDbRows;
    const diet = filterRecipesTabRowsForDietPrefs(source, userDietPrefs);
    const hasPendingStubs = diet.some(
      (row) => row.kind === 'kitchen' && Boolean(row.pantryMatchPending),
    );
    if (hasPendingStubs) return diet;
    return rankTabRows(diet);
  }, [
    classicCategoryRows,
    mealDbRows,
    selectedClassicCategory,
    showCreatorCatalogSections,
    userDietPrefs,
    rankTabRows,
  ]);

  const browseVideoModels = useMemo(() => {
    if (!creatorFeedEnabled || searching) return [];
    const videos = selectedCreator ? channelVideos : feedVideos;
    const models = buildCreatorFeedCardModels(videos, kitchenRecipes, pantryRecipeMatches);
    const diet = filterCreatorFeedModelsForDietPrefs(models, userDietPrefs);
    return rankCreatorModels(diet);
  }, [
    channelVideos,
    creatorFeedEnabled,
    feedVideos,
    kitchenRecipes,
    pantryRecipeMatches,
    searchQuery,
    selectedCreator,
    userDietPrefs,
    rankCreatorModels,
  ]);

  const {
    results: searchResults,
    loading: searchLoading,
    debouncing: searchDebouncing,
    error: searchError,
  } = useUnifiedRecipeSearch({
      query: searchQuery,
      pantry,
      session,
      kitchenRecipes,
      pantryMatches: pantryRecipeMatches,
    });

  const searchResultsFiltered = useMemo(() => {
    const diet = filterRecipeSearchResultsForDietPrefs(searchResults, userDietPrefs);
    return rankSearchResults(diet, searchQuery.trim());
  }, [searchResults, searchQuery, userDietPrefs, rankSearchResults]);

  const resolveRowBeforeUserAction = useCallback(
    async (row: RecipesTabRow): Promise<RecipesTabRow | null> => {
      let working = row;
      if (row.kind === 'kitchen' && row.pantryMatchPending) {
        setRowDetailLoadingId(row.recipe.id);
        try {
          const resolved = await resolveKitchenRecipesTabRowDetails(row, pantry);
          if (!resolved) {
            if (isOffline() && row.pantryMatchPending) {
              notifyRecipeOfflineUnavailable();
            }
            return null;
          }
          working = resolved;
        } finally {
          setRowDetailLoadingId(null);
        }
      }
      if (kitchenRowFailsDietPrefs(working, userDietPrefs)) {
        if (working.kind === 'kitchen') {
          classicCategoryFeed.removeRowById(working.recipe.id);
        }
        notifyRecipeHiddenForDietSettings();
        return null;
      }
      if (row.kind === 'kitchen' && row.pantryMatchPending && working.kind === 'kitchen') {
        classicCategoryFeed.syncRow(working);
      }
      return working;
    },
    [
      classicCategoryFeed,
      notifyRecipeHiddenForDietSettings,
      notifyRecipeOfflineUnavailable,
      pantry,
      userDietPrefs,
    ],
  );

  const toggleKitchenSaveWithResolve = useCallback(
    (row: RecipesTabRow) => {
      void (async () => {
        const resolved = await resolveRowBeforeUserAction(row);
        if (!resolved || resolved.kind !== 'kitchen') return;
        savedRecipes.toggleKitchenRecipe(resolved.recipe);
      })();
    },
    [resolveRowBeforeUserAction, savedRecipes],
  );

  const openDetail = useCallback(
    (row: RecipesTabRow) => {
      void (async () => {
        const resolved = await resolveRowBeforeUserAction(row);
        if (!resolved) return;
        logOpen(refKeyFromRecipesTabRow(resolved));
        setDetailInitialSection('ingredients');
        setPickedDetailRow(resolved);
      })();
    },
    [logOpen, resolveRowBeforeUserAction],
  );

  const openSwapRecipe = useCallback(
    (recipeId: string) => {
      const match = pantryRecipeMatches.byRecipeId.get(recipeId);
      const kitchen = feedKitchenRecipes.find((recipe) => recipe.id === recipeId);
      if (!kitchen || !match) return;
      const row: RecipesTabRow = { kind: 'kitchen', recipe: kitchen, match };
      logCook(refKeyFromRecipesTabRow(row));
      setDetailInitialSection('steps');
      setPickedDetailRow(row);
    },
    [feedKitchenRecipes, logCook, pantryRecipeMatches.byRecipeId],
  );

  const openCookSheetForRow = useCallback(
    (row: RecipesTabRow) => {
      void (async () => {
        const resolved = await resolveRowBeforeUserAction(row);
        if (!resolved) return;
        const refKey = refKeyFromRecipesTabRow(resolved);
        openScheduleRecipe(
          scheduleTargetFromRecipesTabRow(resolved, {
            onOpenCookView: () => {
              logCook(refKey);
              setDetailInitialSection('steps');
              setPickedDetailRow(resolved);
            },
            onJustSave: () => {
              if (resolved.kind !== 'kitchen') return;
              savedRecipes.toggleKitchenRecipe(resolved.recipe);
              logSave(refKey);
            },
            onOpenSwapRecipe: openSwapRecipe,
          }),
        );
      })();
    },
    [logCook, logSave, openScheduleRecipe, openSwapRecipe, resolveRowBeforeUserAction, savedRecipes],
  );

  function showDifferentIdeas() {
    setFeedDiversitySeed((value) => value + 1);
    if (showCreatorCatalogSections) {
      refreshMealDb();
    }
  }

  const detailRow = useMemo(() => {
    if (viralOpenState) return viralOpenState.row;
    if (pickedDetailRow) return pickedDetailRow;
    if (!routeRecipeId) return null;
    const fromFeed = filterBaseRows.find(
      (candidate) => candidate.kind === 'kitchen' && candidate.recipe.id === routeRecipeId,
    );
    if (fromFeed) return fromFeed;
    const kitchen = feedKitchenRecipes.find((recipe) => recipe.id === routeRecipeId);
    if (!kitchen) return null;
    const match = pantryRecipeMatches.byRecipeId.get(kitchen.id);
    if (!match) return null;
    return { kind: 'kitchen' as const, recipe: kitchen, match };
  }, [feedKitchenRecipes, filterBaseRows, pantryRecipeMatches.byRecipeId, pickedDetailRow, routeRecipeId, viralOpenState]);

  const detailMatch = useMemo(() => {
    if (!detailRow) return undefined;
    if (viralOpenState && detailRow.kind === 'kitchen') {
      const imported = findKitchenRecipeBySourceUrl(feedKitchenRecipes, viralOpenState.item.watchUrl);
      if (imported) {
        return pantryRecipeMatches.byRecipeId.get(imported.id) ?? detailRow.match;
      }
      const fresh = pantryRecipeMatches.byRecipeId.get(detailRow.recipe.id);
      if (fresh) return fresh;
    }
    return detailRow.match;
  }, [detailRow, feedKitchenRecipes, pantryRecipeMatches.byRecipeId, viralOpenState]);

  const showLegacyKitchenFeed = !creatorFeedEnabled;

  const hasUnfilteredResults = showLegacyKitchenFeed ? filterBaseRows.length > 0 : false;

  const showFilterEmpty =
    showLegacyKitchenFeed &&
    recipesTabNarrowingFiltersActive(filters) &&
    hasUnfilteredResults &&
    filteredRows.length === 0 &&
    !searching;

  const mealDbBlockingLoad =
    showCreatorCatalogSections &&
    sectionsExpanded.classic &&
    mealDbLoading &&
    mealDbRows.length === 0;
  const creatorFeedBlockingLoad =
    showCreatorCatalogSections &&
    sectionsExpanded.creators &&
    !selectedCreator &&
    feedLoading &&
    browseVideoModels.length === 0;

  const searchInFlight = searching && (searchLoading || searchDebouncing);

  const listLoading =
    searchInFlight ||
    (showCreatorCatalogSections && selectedCreator && channelLoading) ||
    creatorFeedBlockingLoad ||
    mealDbBlockingLoad ||
    (showLegacyKitchenFeed && mealDbLoading && mealDbRows.length === 0);

  const showSearchEmpty =
    searching && !searchLoading && !searchDebouncing && searchResultsFiltered.length === 0;

  const refKeyForCreatorOpen = useCallback(
    (videoId: string) => {
      const model = browseVideoModels.find((entry) => entry.videoId === videoId);
      if (model) return refKeyFromCreatorModel(model);
      const channelModel = channelVideos.find((v) => v.videoId === videoId);
      if (channelModel) {
        const built = buildCreatorFeedCardModels(
          [channelModel],
          kitchenRecipes,
          pantryRecipeMatches,
        )[0];
        if (built) return refKeyFromCreatorModel(built);
      }
      return `creator:${videoId}`;
    },
    [browseVideoModels, channelVideos, kitchenRecipes, pantryRecipeMatches],
  );

  const openCreatorVideo = useCallback(
    (item: Parameters<typeof openViralItem>[0]) => {
      logOpen(refKeyForCreatorOpen(item.videoId));
      openViralItem(item);
    },
    [logOpen, openViralItem, refKeyForCreatorOpen],
  );

  const openCookSheetForCreator = useCallback(
    (model: CreatorFeedCardModel) => {
      const refKey = refKeyFromCreatorModel(model);
      openScheduleRecipe(
        scheduleTargetFromCreatorModel(model, {
          onOpenCookView: () => {
            logCook(refKey);
            openCreatorVideo(model.item);
            setDetailInitialSection('steps');
          },
          onJustSave: () => {
            savedRecipes.toggleCreatorVideo(model.video, model.importedRecipe);
            logSave(refKey);
          },
          onOpenSwapRecipe: openSwapRecipe,
        }),
      );
    },
    [logCook, logSave, openCreatorVideo, openScheduleRecipe, openSwapRecipe, savedRecipes],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searching) {
        for (const result of searchResultsFiltered) {
          if (result.kind === 'classic') {
            logImpression(refKeyFromRecipesTabRow(result.row));
          } else {
            logImpression(refKeyFromCreatorModel(result.model));
          }
        }
        return;
      }
      if (!showCreatorCatalogSections) return;
      if (sectionsExpanded.classic) {
        for (const row of classicRecipeRows) {
          logImpression(refKeyFromRecipesTabRow(row));
        }
      }
      if (sectionsExpanded.creators || selectedCreator) {
        for (const model of browseVideoModels) {
          logImpression(refKeyFromCreatorModel(model));
        }
      }
      if (showLegacyKitchenFeed) {
        for (const row of filteredRows) {
          logImpression(refKeyFromRecipesTabRow(row));
        }
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [
    browseVideoModels,
    classicRecipeRows,
    filteredRows,
    logImpression,
    searchResultsFiltered,
    searching,
    showCreatorCatalogSections,
    showLegacyKitchenFeed,
    sectionsExpanded.classic,
    sectionsExpanded.creators,
    selectedCreator,
  ]);

  const showSignInOnImportError =
    Boolean(viralOpenState?.importError) &&
    viralOpenState?.importError === RECIPE_IMPORT_COPY.guestSignInMessage &&
    !session &&
    !demoMode;

  const activeCreator = selectedCreator ?? channelCreator;

  const activeCreatorWebsite = useMemo(
    () => creatorWebsiteForChannel(activeCreator?.youtubeChannelId),
    [activeCreator?.youtubeChannelId],
  );

  const detailCreatorAvatarUrl = useMemo(() => {
    if (!viralOpenState) return null;
    const videoId = viralOpenState.item.videoId;
    const fromBrowse = browseVideoModels.find((m) => m.videoId === videoId);
    if (fromBrowse) return fromBrowse.video.creatorAvatarUrl;
    const fromChannel = channelVideos.find((v) => v.videoId === videoId);
    return fromChannel?.creatorAvatarUrl ?? null;
  }, [browseVideoModels, channelVideos, viralOpenState]);

  const detailRecipeSaved = useMemo(() => {
    if (!detailRow || detailRow.kind !== 'kitchen') return false;
    if (detailRow.recipe.id.startsWith('viral-preview-') && viralOpenState) {
      const imported = feedKitchenRecipes.find(
        (recipe) => recipe.sourceUrl && recipe.sourceUrl === viralOpenState.item.watchUrl,
      );
      return savedRecipes.isCreatorSaved(viralOpenState.item.videoId, imported ?? null);
    }
    return savedRecipes.isKitchenSaved(detailRow.recipe);
  }, [detailRow, feedKitchenRecipes, savedRecipes, viralOpenState]);

  const detailSaveDisabled = useMemo(() => {
    if (!detailRow || detailRow.kind !== 'kitchen') return false;
    if (detailRow.recipe.id.startsWith('viral-preview-') && viralOpenState) {
      const imported = feedKitchenRecipes.find(
        (recipe) => recipe.sourceUrl && recipe.sourceUrl === viralOpenState.item.watchUrl,
      );
      return savedRecipes.isCreatorSavePending(viralOpenState.item.videoId, imported ?? null);
    }
    return savedRecipes.isKitchenSavePending(detailRow.recipe);
  }, [detailRow, feedKitchenRecipes, savedRecipes, viralOpenState]);

  const detailRankingRefKey = useMemo(() => {
    if (!detailRow) return null;
    if (viralOpenState) return refKeyForCreatorOpen(viralOpenState.item.videoId);
    return refKeyFromRecipesTabRow(detailRow);
  }, [detailRow, refKeyForCreatorOpen, viralOpenState]);

  const detailWontCook = detailRankingRefKey ? isWontCook(detailRankingRefKey) : false;

  const handleToggleDetailWontCook = useCallback(() => {
    if (!detailRankingRefKey) return;
    if (detailWontCook) {
      undoWontCook(detailRankingRefKey);
      return;
    }
    markWontCook(detailRankingRefKey);
    closeViral();
    setPickedDetailRow(null);
  }, [closeViral, detailRankingRefKey, detailWontCook, markWontCook, undoWontCook]);

  const handleToggleKitchenMealPlan = useCallback(
    async (recipeId: string) => {
      const onPlan = isOnMealPlan({ recipeSlug: recipeId });
      await toggleMealPlanKitchenRecipe(recipeId);
      if (!onPlan && detailRankingRefKey) {
        logCook(detailRankingRefKey);
      }
    },
    [detailRankingRefKey, isOnMealPlan, logCook, toggleMealPlanKitchenRecipe],
  );

  const handleToggleDiscoveryMealPlan = useCallback(
    async (recipe: RecipeDiscoveryListItem) => {
      const onPlan = isOnMealPlan({ recipeApiId: recipe.id });
      await toggleMealPlanDiscoveryRecipe(recipe);
      if (!onPlan && detailRankingRefKey) {
        logCook(detailRankingRefKey);
      }
    },
    [detailRankingRefKey, isOnMealPlan, logCook, toggleMealPlanDiscoveryRecipe],
  );

  function toggleDetailRecipeSave() {
    if (!detailRow || detailRow.kind !== 'kitchen') return;
    if (detailRow.recipe.id.startsWith('viral-preview-') && viralOpenState) {
      const imported = feedKitchenRecipes.find(
        (recipe) => recipe.sourceUrl && recipe.sourceUrl === viralOpenState.item.watchUrl,
      );
      savedRecipes.toggleViralItem(viralOpenState.item, imported ?? null);
      return;
    }
    savedRecipes.toggleKitchenRecipe(detailRow.recipe);
  }

  const detailCookTarget = useMemo(() => {
    if (!detailRow) return null;
    const refKey = detailRankingRefKey ?? refKeyFromRecipesTabRow(detailRow);
    return scheduleTargetFromRecipesTabRow(detailRow, {
      onOpenCookView: () => {
        logCook(refKey);
        setDetailInitialSection('steps');
      },
      onJustSave: () => {
        toggleDetailRecipeSave();
        logSave(refKey);
      },
      onOpenSwapRecipe: openSwapRecipe,
    });
  }, [detailRankingRefKey, detailRow, logCook, logSave, openSwapRecipe]);

  const handleCreatorSlotPress = useCallback(
    (slot: CreatorRotationSlot) => {
      tabSurface.logCreatorOpen(slot.creator.id, slot.position, slot.slotType);
      tabSurface.setCreatorsExpanded(true);
      handleSelectCreator(slot.creator);
    },
    [handleSelectCreator, tabSurface],
  );

  const handleCategoryChipPress = useCallback(
    (chip: MealDbCategoryChip) => {
      tabSurface.logCategoryOpen(chip.category, chip.position);
      tabSurface.setClassicExpanded(true);
      setSelectedClassicCategory(chip.category);
    },
    [tabSurface],
  );

  const handleCategoryChipPressIn = useCallback(
    (chip: MealDbCategoryChip) => {
      prefetchMealDbCategoryOnIntent(chip.category, pantry);
    },
    [pantry],
  );

  function openSavedRecipeRow(row: RecipesTabRow) {
    if (row.kind === 'kitchen' && row.recipe.id.startsWith('viral-preview-')) {
      const record = savedRecipes.records.find((entry) => {
        const item = savedCreatorItemFromRecord(entry);
        return item?.videoId && row.recipe.id === `viral-preview-${item.videoId}`;
      });
      const item = record ? savedCreatorItemFromRecord(record) : null;
      if (item) {
        openCreatorVideo(item);
        return;
      }
    }
    openDetail(row);
  }

  return (
    <ScrollView
      className="flex-1 bg-paper px-4 pb-8"
      {...homeScrollRefresh.scrollViewProps}
      refreshControl={homeScrollRefresh.refreshControl}
    >
      <HomeWebPullRefreshIndicator
        visible={homeScrollRefresh.pullIndicatorOffset > 0 || homeRecipesRefresh.refreshing}
        refreshing={homeRecipesRefresh.refreshing}
        pullDistance={homeScrollRefresh.pullDistance ?? 0}
      />
      {showCreatorCatalogSections && !searching ? <HomePantryCta /> : null}
      <InstallAppBanner />
      <GuestSaveNudge />
      {cookConfirmPrompt ? (
        <CookConfirmBanner
          title={cookConfirmPrompt.title}
          busy={cookConfirmBusy}
          onYes={() => void confirmCookConfirmPrompt()}
          onNotThisTime={declineCookConfirmPrompt}
          onDismiss={dismissCookConfirmPrompt}
        />
      ) : null}
      {demoMode ? (
        <Text className="mt-3 text-xs text-muted">
          Demo mode — local data only until you sign in with a connected account.
        </Text>
      ) : null}
      <Card
        className="mt-4"
        title={creatorFeedEnabled ? undefined : RECIPES_COPY.cookNowCard.title}
        subtitle={
          creatorFeedEnabled
            ? RECIPES_COPY.homeToolbarCard.subtitle
            : RECIPES_COPY.cookNowCard.subtitle
        }
        subtitleClassName={
          creatorFeedEnabled ? 'mt-1 text-base text-muted' : undefined
        }
      >
        {selectedCreator ? (
          <Pressable
            onPress={() => setSelectedCreator(null)}
            className="mb-2 min-h-[36px] justify-center"
            accessibilityRole="button"
            accessibilityLabel="Back to all creators"
          >
            <Text className="text-sm font-semibold text-primary">← All creators</Text>
          </Pressable>
        ) : null}
        {activeCreator && selectedCreator ? (
          <Text className="mb-2 text-sm font-semibold text-ink">{activeCreator.displayName}</Text>
        ) : null}
        {activeCreator && selectedCreator && activeCreatorWebsite ? (
          <CreatorRecipeWebsiteLink website={activeCreatorWebsite} />
        ) : null}
        <View className="mt-2 min-w-0 flex-row items-center gap-1.5">
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={
              creatorFeedEnabled
                ? CREATOR_RECIPES_COPY.searchPlaceholder
                : RECIPES_COPY.discoveryPanel.searchPlaceholder
            }
            placeholderTextColor={THEME.muted}
            className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2.5 text-base text-ink"
            style={{ flexGrow: 1, flexShrink: 1, minWidth: 0 }}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search recipes"
          />
          {creatorFeedEnabled && !searching ? (
            <CreatorRecipesFeedModeDropdown value={feedMode} onChange={handleFeedModeChange} />
          ) : null}
        </View>
        <RecipeImportFromShareParams
          url={typeof params.url === 'string' ? params.url : undefined}
          text={typeof params.text === 'string' ? params.text : undefined}
          autoRun={autoStartSharedImport}
        />
        {showLegacyKitchenFeed ? (
          <RecipesTabFilterBar
            baseRows={filterBaseRows}
            filters={filters}
            onSetFilter={setFilter}
            onClearAll={clearAllFilters}
          />
        ) : null}
        {pantryEmpty ? (
          <Text className="mt-2 text-xs text-muted">{RECIPES_COPY.cookNowCard.emptyPantryBrowseHint}</Text>
        ) : null}
        {showLegacyKitchenFeed ? (
          <Pressable
            onPress={showDifferentIdeas}
            disabled={mealDbLoading}
            className="mt-2 min-h-[40px] items-center justify-center rounded-lg px-3 py-2"
            accessibilityRole="button"
            accessibilityLabel={RECIPES_COPY.cookNowCard.showDifferentIdeas}
          >
            <Text className="text-sm font-semibold text-primary">
              {mealDbLoading
                ? RECIPES_COPY.discoveryPanel.searching
                : RECIPES_COPY.cookNowCard.showDifferentIdeas}
            </Text>
          </Pressable>
        ) : null}
      </Card>

      {listLoading ? (
        <View className="mt-4 flex-row items-center gap-2">
          <ActivityIndicator color={THEME.primary} />
          <Text className="text-sm text-muted">
            {searchInFlight ? RECIPES_COPY.discoveryPanel.searching : CREATOR_RECIPES_COPY.loading}
          </Text>
        </View>
      ) : null}

      {searchError ? <Text className="mt-3 text-sm text-muted">{searchError}</Text> : null}
      {feedError && !searching ? <Text className="mt-3 text-sm text-muted">{feedError}</Text> : null}
      {channelError && selectedCreator ? (
        <Text className="mt-3 text-sm text-muted">{channelError}</Text>
      ) : null}
      {showCreatorCatalogSections &&
      mealDbError &&
      mealDbRows.length === 0 &&
      classicRecipeRows.length === 0 &&
      !isOffline() ? (
        <Text className="mt-3 text-sm text-muted">{mealDbError}</Text>
      ) : null}

      {searchTyping ? (
        <Text className="mt-4 text-sm text-muted">{CREATOR_RECIPES_COPY.searchTypingHint}</Text>
      ) : null}

      {showFilterEmpty ? <RecipesTabFiltersEmptyState onClearAll={clearAllFilters} /> : null}
      {showSearchEmpty ? (
        <Text className="mt-4 text-sm text-muted">
          {CREATOR_RECIPES_COPY.emptySearchForQuery(searchTrimmed)}
        </Text>
      ) : null}
      {searching
        ? searchResultsFiltered.map((result) =>
            result.kind === 'classic' ? (
              <RecipesUnifiedFeedCard
                key={`classic-${result.row.recipe.id}`}
                row={result.row}
                sourceTag={sourceTagForRecipesTabRow(result.row)}
                saved={
                  result.row.kind === 'kitchen'
                    ? savedRecipes.isKitchenSaved(result.row.recipe)
                    : false
                }
                onToggleSave={
                  result.row.kind === 'kitchen'
                    ? () => toggleKitchenSaveWithResolve(result.row)
                    : undefined
                }
                saveDisabled={
                  result.row.kind === 'kitchen'
                    ? savedRecipes.isKitchenSavePending(result.row.recipe)
                    : false
                }
                interactionLoading={
                  result.row.kind === 'kitchen' && result.row.recipe.id === rowDetailLoadingId
                }
                onOpen={() => openDetail(result.row)}
                onCook={() => openCookSheetForRow(result.row)}
              />
            ) : (
              <CreatorRecipesFeedCard
                key={result.model.videoId}
                model={result.model}
                saved={savedRecipes.isCreatorSaved(
                  result.model.videoId,
                  result.model.importedRecipe,
                )}
                onToggleSave={() =>
                  savedRecipes.toggleCreatorVideo(result.model.video, result.model.importedRecipe)
                }
                saveDisabled={savedRecipes.isCreatorSavePending(
                  result.model.videoId,
                  result.model.importedRecipe,
                )}
                onOpen={() => {
                  openCreatorVideo(result.model.item);
                }}
                onCook={() => openCookSheetForCreator(result.model)}
              />
            ),
          )
        : null}

      {showCreatorCatalogSections && !searching ? (
        <>
          <HomeRecipesRefreshButton
            visible
            refreshing={homeRecipesRefresh.refreshing}
            statusMessage={homeRecipesRefresh.statusMessage}
            onPress={homeRecipesRefresh.onRefresh}
          />
          <RecipesTabCollapsibleSection
            title={RECIPES_TAB_SURFACE_COPY.classicSectionTitle}
            expanded={tabSurface.sections.classic}
            onToggle={() => tabSurface.setClassicExpanded(!tabSurface.sections.classic)}
            loading={tabSurface.sections.classic && (mealDbBlockingLoad || mealDbCategoriesLoading)}
            bubbleRow={
              <CategoryAvatarsRow
                chips={tabSurface.categoryChips}
                onSelect={handleCategoryChipPress}
                onPressIn={handleCategoryChipPressIn}
                onImpression={(chip) =>
                  tabSurface.logCategoryImpression(chip.category, chip.position)
                }
              />
            }
          >
            {selectedClassicCategory ? (
              <Pressable
                onPress={() => setSelectedClassicCategory(null)}
                className="mb-2 min-h-[36px] justify-center"
                accessibilityRole="button"
                accessibilityLabel="Show all classic categories"
              >
                <Text className="text-sm font-semibold text-primary">← All categories</Text>
              </Pressable>
            ) : null}
            {classicCategoryFeed.offlineCategoryEmpty && classicRecipeRows.length === 0 ? (
              <Text className="mb-2 text-sm text-muted">{MEALDB_COPY.categoryOfflineEmpty}</Text>
            ) : null}
            {classicCategoryFeed.loadFailed && classicRecipeRows.length === 0 ? (
              <View className="mb-2">
                <Text className="text-sm text-muted">{MEALDB_COPY.categoryLoadFailed}</Text>
                <Pressable
                  onPress={classicCategoryFeed.retryLoad}
                  className="mt-2 min-h-[40px] justify-center rounded-lg px-3 py-2"
                  accessibilityRole="button"
                  accessibilityLabel={MEALDB_COPY.categoryRetry}
                >
                  <Text className="text-sm font-semibold text-primary">{MEALDB_COPY.categoryRetry}</Text>
                </Pressable>
              </View>
            ) : null}
            {(mealDbBlockingLoad || classicCategoryLoading) && classicRecipeRows.length === 0 ? (
              <RecipesFeedCardSkeleton count={4} />
            ) : null}
            {classicRecipeRows.map((row) => (
              <RecipesUnifiedFeedCard
                key={row.recipe.id}
                row={row}
                maskTitle={
                  maskClassicStubTitles &&
                  row.kind === 'kitchen' &&
                  Boolean(row.pantryMatchPending)
                }
                maskImage={
                  maskClassicStubTitles &&
                  row.kind === 'kitchen' &&
                  Boolean(row.pantryMatchPending)
                }
                saved={row.kind === 'kitchen' ? savedRecipes.isKitchenSaved(row.recipe) : false}
                onToggleSave={
                  row.kind === 'kitchen' ? () => toggleKitchenSaveWithResolve(row) : undefined
                }
                saveDisabled={
                  row.kind === 'kitchen' ? savedRecipes.isKitchenSavePending(row.recipe) : false
                }
                interactionLoading={row.kind === 'kitchen' && row.recipe.id === rowDetailLoadingId}
                onOpen={() => openDetail(row)}
                onCook={() => openCookSheetForRow(row)}
              />
            ))}
            {mealDbLoadingMore && classicRecipeRows.length > 0 ? (
              <View className="mt-1 flex-row items-center gap-2">
                <ActivityIndicator color={THEME.primary} size="small" />
                <Text className="text-xs text-muted">{MEALDB_COPY.loading}</Text>
              </View>
            ) : null}
          </RecipesTabCollapsibleSection>

          <RecipesTabCollapsibleSection
            title={CREATOR_RECIPES_COPY.creatorsSectionTitle}
            expanded={tabSurface.sections.creators}
            onToggle={() => tabSurface.setCreatorsExpanded(!tabSurface.sections.creators)}
            loading={tabSurface.sections.creators && creatorsLoading && creators.length === 0}
            bubbleRow={
              !selectedCreator ? (
                <CreatorAvatarsRow
                  slots={tabSurface.creatorSlots}
                  onSelect={handleCreatorSlotPress}
                  onImpression={(slot) =>
                    tabSurface.logCreatorImpression(
                      slot.creator.id,
                      slot.position,
                      slot.slotType,
                    )
                  }
                />
              ) : null
            }
          >
            {!selectedCreator ? (
              <>
                {creatorsLoading ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator color={THEME.primary} size="small" />
                    <Text className="text-xs text-muted">{CREATOR_RECIPES_COPY.loadingCreators}</Text>
                  </View>
                ) : null}
                {!creatorsLoading && creatorsError ? (
                  <Text className="text-xs text-muted">{creatorsError}</Text>
                ) : null}
                {!creatorsLoading && tabSurface.creatorSlots.length === 0 ? (
                  <Text className="text-xs text-muted">{CREATOR_RECIPES_COPY.emptyCreators}</Text>
                ) : null}
              </>
            ) : null}
            {browseVideoModels.map((model) => (
              <CreatorRecipesFeedCard
                key={model.videoId}
                model={model}
                saved={savedRecipes.isCreatorSaved(model.videoId, model.importedRecipe)}
                onToggleSave={() => savedRecipes.toggleCreatorVideo(model.video, model.importedRecipe)}
                saveDisabled={savedRecipes.isCreatorSavePending(model.videoId, model.importedRecipe)}
                onOpen={() => {
                  openCreatorVideo(model.item);
                }}
                onCook={() => openCookSheetForCreator(model)}
              />
            ))}
            {!selectedCreator && browseVideoModels.length === 0 && feedLoading ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator color={THEME.primary} size="small" />
                <Text className="text-xs text-muted">{CREATOR_RECIPES_COPY.loading}</Text>
              </View>
            ) : null}
            {!selectedCreator &&
            browseVideoModels.length === 0 &&
            !feedLoading ? (
              <Text className="text-sm text-muted">{CREATOR_RECIPES_COPY.emptyVideos}</Text>
            ) : null}
          </RecipesTabCollapsibleSection>
        </>
      ) : null}

      {showLegacyKitchenFeed
        ? filteredRows.map((row) => (
            <RecipesUnifiedFeedCard
              key={row.kind === 'kitchen' ? row.recipe.id : `api-${row.recipe.id}`}
              row={row}
              saved={row.kind === 'kitchen' ? savedRecipes.isKitchenSaved(row.recipe) : false}
              onToggleSave={
                row.kind === 'kitchen'
                  ? () => {
                      if (row.kind !== 'kitchen') return;
                      savedRecipes.toggleKitchenRecipe(row.recipe);
                    }
                  : undefined
              }
              saveDisabled={row.kind === 'kitchen' ? savedRecipes.isKitchenSavePending(row.recipe) : false}
              onOpen={() => openDetail(row)}
              onCook={() => openCookSheetForRow(row)}
            />
          ))
        : null}

      <HomeHubSheet
        rows={savedRecipes.feedRows}
        guestHint={isGuest && !demoMode}
        onOpenRow={openSavedRecipeRow}
      />

      <RecipeDetailSheet
        visible={detailRow != null}
        row={detailRow}
        match={detailMatch}
        viralItem={viralOpenState?.item ?? null}
        creatorAvatarUrl={detailCreatorAvatarUrl}
        importing={viralOpenState?.importing ?? false}
        importError={viralOpenState?.importError}
        onRetryImport={
          viralOpenState?.importError && !showSignInOnImportError ? retryImport : undefined
        }
        onStartImport={viralOpenState ? startImport : undefined}
        onSignInForImport={showSignInOnImportError ? openAuthSheet : undefined}
        onClose={() => {
          finishCookViewSession();
          closeViral();
          setPickedDetailRow(null);
          setDetailInitialSection('ingredients');
          if (routeRecipeId) router.replace('/');
        }}
        cookTarget={detailCookTarget}
        initialDetailSection={detailInitialSection}
        onAddMissingKitchen={addMissingRecipeIngredientsToGrocery}
        onAddMissingDiscovery={addMissingDiscoveryRecipeIngredientsToGrocery}
        isOnMealPlan={isOnMealPlan}
        onToggleKitchen={(recipeId) => void handleToggleKitchenMealPlan(recipeId)}
        onToggleDiscovery={(recipe) => void handleToggleDiscoveryMealPlan(recipe)}
        wontCookAgain={detailWontCook}
        onToggleWontCook={detailRankingRefKey ? handleToggleDetailWontCook : undefined}
        onClearRecipeSource={(recipeId) => void clearImportedRecipeSource(recipeId)}
        recipeSaved={detailRecipeSaved}
        onToggleSaveRecipe={detailRow?.kind === 'kitchen' ? toggleDetailRecipeSave : undefined}
        saveDisabled={detailSaveDisabled}
      />
    </ScrollView>
  );
}
