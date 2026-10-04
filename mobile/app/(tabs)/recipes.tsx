import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Card } from '../../components/Card';
import { RecipeDetailSheet } from '../../components/recipes/RecipeDetailSheet';
import { CreatorAvatarsRow } from '../../components/recipes/CreatorAvatarsRow';
import { CreatorRecipesFeedCard } from '../../components/recipes/CreatorRecipesFeedCard';
import { CreatorRecipesFeedModeDropdown } from '../../components/recipes/CreatorRecipesFeedModeDropdown';
import { RecipesUnifiedFeedCard } from '../../components/recipes/RecipesUnifiedFeedCard';
import { RecipesTabFilterBar, RecipesTabFiltersEmptyState } from '../../components/RecipesTabFilterBar';
import { RecipesEmptyState } from '../../components/RecipesEmptyState';
import { RECIPES_COPY } from '../../config/recipesCopy';
import { THEME, isCreatorRecipesConfigured } from '../../config/appConfig';
import {
  applyRecipesTabFilters,
  recipesTabNarrowingFiltersActive,
  recipesTabPeopleTargetServings,
  type RecipesTabRow,
} from '../../config/recipesTabFilters';
import {
  CREATOR_RECIPES_COPY,
  isClassicRecipesFeedMode,
  isCreatorBrowseMode,
  type CreatorRecipesBrowseMode,
  type CreatorRecipesFeedMode,
} from '../../config/creatorRecipes';
import { SAVED_RECIPES_COPY } from '../../config/savedRecipes';
import { useRecipesTabFilters } from '../../hooks/useRecipesTabFilters';
import { useCreatorChannelVideos, useCreatorFeed, useCreatorList } from '../../hooks/useCreatorRecipes';
import { useUnifiedRecipeSearch } from '../../hooks/useUnifiedRecipeSearch';
import { useViralRecipeOpen } from '../../hooks/useViralRecipeOpen';
import { useApp } from '../../context/AppContext';
import { buildRecipesTabCatalogRows } from '../../lib/recipes/recipesTabCatalog';
import { buildUnifiedRecipesFeed } from '../../lib/recipes/unifiedFeed';
import { buildCreatorFeedCardModels } from '../../lib/recipes/creatorFeedRows';
import { useSavedRecipes } from '../../hooks/useSavedRecipes';
import { MyRecipesSheet } from '../../components/recipes/MyRecipesSheet';
import { savedCreatorItemFromRecord } from '../../lib/savedRecipes/resolveRows';
import { RECIPE_SOURCES } from '../../config/recipeSources';
import { MEALDB_COPY } from '../../config/mealdb';
import { useMealDbRecipes } from '../../hooks/useMealDbRecipes';
import { RecipeImportFromShareParams } from '../../components/recipes/RecipeImportFromLink';
import { RECIPE_IMPORT_COPY } from '../../config/recipeImport';
import type { CreatorListItem } from '../../lib/creatorVideos/types';

export default function RecipesScreen() {
  const params = useLocalSearchParams<{ recipeId?: string; url?: string; text?: string; import?: string }>();
  const {
    pantry,
    session,
    demoMode,
    openAuthSheet,
    saveLinkImportedRecipe,
    servingOverrides,
    applyServingOverridesBatch,
    featureFlags,
    pantryRecipeMatches,
    addMissingRecipeIngredientsToGrocery,
    addMissingDiscoveryRecipeIngredientsToGrocery,
    toggleMealPlanDiscoveryRecipe,
    isOnMealPlan,
    toggleMealPlanKitchenRecipe,
    onboarding,
    feedKitchenRecipes,
    isGuest,
  } = useApp();
  const routeRecipeId =
    typeof params.recipeId === 'string' && params.recipeId ? params.recipeId : null;
  const [pickedDetailRow, setPickedDetailRow] = useState<RecipesTabRow | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedMode, setFeedMode] = useState<CreatorRecipesFeedMode>('popular');
  const [selectedCreator, setSelectedCreator] = useState<CreatorListItem | null>(null);
  const creatorFeedEnabled =
    RECIPE_SOURCES.creatorRecipesPrimaryFeed && isCreatorRecipesConfigured();
  const browseMode: CreatorRecipesBrowseMode = isCreatorBrowseMode(feedMode) ? feedMode : 'popular';
  const showClassicRecipesFeed = creatorFeedEnabled && isClassicRecipesFeedMode(feedMode);
  const [myRecipesOpen, setMyRecipesOpen] = useState(false);

  const savedRecipes = useSavedRecipes({
    session,
    demoMode,
    isGuest,
    kitchenRecipes: feedKitchenRecipes,
    pantry,
    pantryMatches: pantryRecipeMatches,
  });

  const { creators, loading: creatorsLoading, error: creatorsError } = useCreatorList(session, {
    enabled: creatorFeedEnabled && !searchQuery.trim() && !selectedCreator,
  });

  const { videos: feedVideos, loading: feedLoading, error: feedError } = useCreatorFeed(
    session,
    browseMode,
    { enabled: creatorFeedEnabled && isCreatorBrowseMode(feedMode) && !searchQuery.trim() && !selectedCreator },
  );

  const {
    creator: channelCreator,
    videos: channelVideos,
    loading: channelLoading,
    error: channelError,
  } = useCreatorChannelVideos(session, selectedCreator?.youtubeChannelId ?? null, {
    enabled: creatorFeedEnabled && Boolean(selectedCreator) && !searchQuery.trim(),
  });

  const {
    rows: mealDbRows,
    loading: mealDbLoading,
    error: mealDbError,
    refreshMealDb,
  } = useMealDbRecipes(pantry, { enabled: showClassicRecipesFeed && !searchQuery.trim() });

  const {
    viralOpenState,
    openViralItem,
    closeViral,
    retryImport,
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

  const [feedDiversitySeed, setFeedDiversitySeed] = useState(0);
  const { filters, setFilter, clearAllFilters } = useRecipesTabFilters();
  const pantryEmpty = pantry.length === 0;

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
    return buildUnifiedRecipesFeed(narrowed, searchQuery, { diversitySeed: feedDiversitySeed });
  }, [filterBaseRows, filters, searchQuery, feedDiversitySeed]);

  const classicRecipeRows = useMemo(() => {
    if (!showClassicRecipesFeed || searchQuery.trim()) return [];
    return mealDbRows;
  }, [mealDbRows, searchQuery, showClassicRecipesFeed]);

  const browseVideoModels = useMemo(() => {
    if (!creatorFeedEnabled || searchQuery.trim()) return [];
    const videos = selectedCreator ? channelVideos : feedVideos;
    return buildCreatorFeedCardModels(videos, kitchenRecipes, pantryRecipeMatches);
  }, [
    channelVideos,
    creatorFeedEnabled,
    feedVideos,
    kitchenRecipes,
    pantryRecipeMatches,
    searchQuery,
    selectedCreator,
  ]);

  const { results: searchResults, loading: searchLoading, error: searchError } =
    useUnifiedRecipeSearch({
      query: searchQuery,
      pantry,
      session,
      kitchenRecipes,
      pantryMatches: pantryRecipeMatches,
    });

  function openDetail(row: RecipesTabRow) {
    setPickedDetailRow(row);
    onboarding.notifyTutorialStepComplete('recipes');
  }

  function showDifferentIdeas() {
    setFeedDiversitySeed((value) => value + 1);
    if (showClassicRecipesFeed) {
      refreshMealDb();
    }
  }

  const detailRow = useMemo(() => {
    if (viralOpenState) return viralOpenState.row;
    if (pickedDetailRow) return pickedDetailRow;
    if (!routeRecipeId) return null;
    return (
      filterBaseRows.find(
        (candidate) => candidate.kind === 'kitchen' && candidate.recipe.id === routeRecipeId,
      ) ?? null
    );
  }, [filterBaseRows, pickedDetailRow, routeRecipeId, viralOpenState]);

  const detailMatch = useMemo(() => {
    if (!detailRow) return undefined;
    if (viralOpenState && detailRow.kind === 'kitchen') {
      const fresh = pantryRecipeMatches.byRecipeId.get(detailRow.recipe.id);
      if (fresh) return fresh;
    }
    return detailRow.match;
  }, [detailRow, pantryRecipeMatches.byRecipeId, viralOpenState]);

  const peopleTargetServings = recipesTabPeopleTargetServings(filters.people);
  useEffect(() => {
    if (peopleTargetServings == null) return;
    const updates: Record<string, number> = {};
    for (const recipe of kitchenRecipes) {
      updates[recipe.id] = peopleTargetServings;
    }
    applyServingOverridesBatch(updates);
  }, [applyServingOverridesBatch, kitchenRecipes, peopleTargetServings]);

  const showLegacyKitchenFeed = !creatorFeedEnabled;
  const searching = searchQuery.trim().length >= 2;

  const hasUnfilteredResults = showClassicRecipesFeed
      ? mealDbRows.length > 0
      : showLegacyKitchenFeed
        ? filterBaseRows.length > 0
        : selectedCreator
          ? channelVideos.length > 0
          : browseVideoModels.length > 0 || creators.length > 0;

  const showFilterEmpty =
    showLegacyKitchenFeed &&
    recipesTabNarrowingFiltersActive(filters) &&
    hasUnfilteredResults &&
    filteredRows.length === 0 &&
    !searching;

  const listLoading =
    (searching && searchLoading) ||
    (showClassicRecipesFeed && mealDbLoading) ||
    (creatorFeedEnabled &&
      !searching &&
      (selectedCreator ? channelLoading : isCreatorBrowseMode(feedMode) ? feedLoading : false));

  const showCatalogEmpty =
    !showFilterEmpty &&
    !listLoading &&
    !hasUnfilteredResults &&
    !searching &&
    creatorFeedEnabled;

  const showSearchEmpty =
    searching && !searchLoading && searchResults.length === 0;

  const showSignInOnImportError =
    Boolean(viralOpenState?.importError) &&
    viralOpenState?.importError === RECIPE_IMPORT_COPY.guestSignInMessage &&
    !session &&
    !demoMode;

  const activeCreator = selectedCreator ?? channelCreator;

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

  function openSavedRecipeRow(row: RecipesTabRow) {
    setMyRecipesOpen(false);
    if (row.kind === 'kitchen' && row.recipe.id.startsWith('viral-preview-')) {
      const record = savedRecipes.records.find((entry) => {
        const item = savedCreatorItemFromRecord(entry);
        return item?.videoId && row.recipe.id === `viral-preview-${item.videoId}`;
      });
      const item = record ? savedCreatorItemFromRecord(record) : null;
      if (item) {
        openViralItem(item);
        onboarding.notifyTutorialStepComplete('recipes');
        return;
      }
    }
    openDetail(row);
  }

  return (
    <ScrollView className="flex-1 bg-paper px-4 pb-8">
      <Card
        className="mt-4"
        title={creatorFeedEnabled ? CREATOR_RECIPES_COPY.feedTitle : RECIPES_COPY.cookNowCard.title}
        subtitle={
          creatorFeedEnabled ? CREATOR_RECIPES_COPY.feedSubtitle : RECIPES_COPY.cookNowCard.subtitle
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
        <View className="mt-2 flex-row items-center gap-2">
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={
              creatorFeedEnabled
                ? CREATOR_RECIPES_COPY.searchPlaceholder
                : RECIPES_COPY.discoveryPanel.searchPlaceholder
            }
            placeholderTextColor={THEME.muted}
            className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search recipes"
          />
          {creatorFeedEnabled ? (
            <Pressable
              onPress={() => setMyRecipesOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={SAVED_RECIPES_COPY.myRecipesButton}
              className="rounded-lg border border-border bg-card px-2.5 py-2"
            >
              <Text className="text-[11px] font-semibold text-ink">{SAVED_RECIPES_COPY.myRecipesButton}</Text>
            </Pressable>
          ) : null}
          {creatorFeedEnabled && !searching ? (
            <CreatorRecipesFeedModeDropdown value={feedMode} onChange={setFeedMode} />
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
        {creatorFeedEnabled && !searching && !selectedCreator ? (
          <CreatorAvatarsRow creators={creators} onSelect={setSelectedCreator} />
        ) : null}
        {creatorsLoading && creatorFeedEnabled && !searching && !selectedCreator ? (
          <View className="mt-3 flex-row items-center gap-2">
            <ActivityIndicator color={THEME.primary} size="small" />
            <Text className="text-xs text-muted">{CREATOR_RECIPES_COPY.loadingCreators}</Text>
          </View>
        ) : null}
        {!creatorsLoading && creatorsError ? (
          <Text className="mt-2 text-xs text-muted">{creatorsError}</Text>
        ) : null}
        {!creatorsLoading &&
        creatorFeedEnabled &&
        !searching &&
        !selectedCreator &&
        creators.length === 0 ? (
          <Text className="mt-2 text-xs text-muted">{CREATOR_RECIPES_COPY.emptyCreators}</Text>
        ) : null}
      </Card>

      {listLoading ? (
        <View className="mt-4 flex-row items-center gap-2">
          <ActivityIndicator color={THEME.primary} />
          <Text className="text-sm text-muted">
            {searching ? RECIPES_COPY.discoveryPanel.searching : CREATOR_RECIPES_COPY.loading}
          </Text>
        </View>
      ) : null}

      {searchError ? <Text className="mt-3 text-sm text-muted">{searchError}</Text> : null}
      {feedError && !searching ? <Text className="mt-3 text-sm text-muted">{feedError}</Text> : null}
      {channelError && selectedCreator ? (
        <Text className="mt-3 text-sm text-muted">{channelError}</Text>
      ) : null}
      {showClassicRecipesFeed && mealDbError ? (
        <Text className="mt-3 text-sm text-muted">{mealDbError}</Text>
      ) : null}

      {showCatalogEmpty ? <RecipesEmptyState pantryEmpty={false} /> : null}
      {showFilterEmpty ? <RecipesTabFiltersEmptyState onClearAll={clearAllFilters} /> : null}
      {showSearchEmpty ? (
        <Text className="mt-4 text-sm text-muted">{CREATOR_RECIPES_COPY.emptySearch}</Text>
      ) : null}

      {searching
        ? searchResults.map((result) =>
            result.kind === 'classic' ? (
              <RecipesUnifiedFeedCard
                key={`classic-${result.row.recipe.id}`}
                row={result.row}
                sourceTag={CREATOR_RECIPES_COPY.sourceClassic}
                saved={
                  result.row.kind === 'kitchen'
                    ? savedRecipes.isKitchenSaved(result.row.recipe)
                    : false
                }
                onToggleSave={
                  result.row.kind === 'kitchen'
                    ? () => {
                        if (result.row.kind !== 'kitchen') return;
                        savedRecipes.toggleKitchenRecipe(result.row.recipe);
                      }
                    : undefined
                }
                onOpen={() => openDetail(result.row)}
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
                onOpen={() => {
                  openViralItem(result.model.item);
                  onboarding.notifyTutorialStepComplete('recipes');
                }}
              />
            ),
          )
        : null}

      {showClassicRecipesFeed && !searching
        ? classicRecipeRows.map((row) => (
            <RecipesUnifiedFeedCard
              key={row.recipe.id}
              row={row}
              sourceTag={MEALDB_COPY.feedModeLabel}
              saved={row.kind === 'kitchen' ? savedRecipes.isKitchenSaved(row.recipe) : false}
              onToggleSave={
                row.kind === 'kitchen'
                  ? () => {
                      if (row.kind !== 'kitchen') return;
                      savedRecipes.toggleKitchenRecipe(row.recipe);
                    }
                  : undefined
              }
              onOpen={() => openDetail(row)}
            />
          ))
        : null}

      {creatorFeedEnabled &&
      isCreatorBrowseMode(feedMode) &&
      !searching &&
      !showClassicRecipesFeed
        ? browseVideoModels.map((model) => (
            <CreatorRecipesFeedCard
              key={model.videoId}
              model={model}
              saved={savedRecipes.isCreatorSaved(model.videoId, model.importedRecipe)}
              onToggleSave={() => savedRecipes.toggleCreatorVideo(model.video, model.importedRecipe)}
              onOpen={() => {
                openViralItem(model.item);
                onboarding.notifyTutorialStepComplete('recipes');
              }}
            />
          ))
        : null}

      {creatorFeedEnabled &&
      !searching &&
      !showClassicRecipesFeed &&
      isCreatorBrowseMode(feedMode) &&
      !selectedCreator &&
      browseVideoModels.length === 0 &&
      !feedLoading ? (
        <Text className="mt-4 text-sm text-muted">{CREATOR_RECIPES_COPY.emptyVideos}</Text>
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
              onOpen={() => openDetail(row)}
            />
          ))
        : null}

      <MyRecipesSheet
        visible={myRecipesOpen}
        onClose={() => setMyRecipesOpen(false)}
        rows={savedRecipes.feedRows}
        guestHint={isGuest && !demoMode}
        onOpenRow={openSavedRecipeRow}
      />

      <RecipeDetailSheet
        visible={detailRow != null}
        row={detailRow}
        match={detailMatch}
        importing={viralOpenState?.importing ?? false}
        importError={viralOpenState?.importError}
        onRetryImport={
          viralOpenState?.importError && !showSignInOnImportError ? retryImport : undefined
        }
        onSignInForImport={showSignInOnImportError ? openAuthSheet : undefined}
        onClose={() => {
          closeViral();
          setPickedDetailRow(null);
          if (routeRecipeId) router.replace('/recipes');
        }}
        onAddMissingKitchen={addMissingRecipeIngredientsToGrocery}
        onAddMissingDiscovery={addMissingDiscoveryRecipeIngredientsToGrocery}
        isOnMealPlan={isOnMealPlan}
        onToggleKitchen={(recipeId) => void toggleMealPlanKitchenRecipe(recipeId)}
        onToggleDiscovery={(recipe) => void toggleMealPlanDiscoveryRecipe(recipe)}
        recipeSaved={detailRecipeSaved}
        onToggleSaveRecipe={detailRow?.kind === 'kitchen' ? toggleDetailRecipeSave : undefined}
      />
    </ScrollView>
  );
}
