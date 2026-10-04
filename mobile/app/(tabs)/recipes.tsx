import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Card } from '../../components/Card';
import { RecipeDetailSheet } from '../../components/recipes/RecipeDetailSheet';
import { RecipesUnifiedFeedCard } from '../../components/recipes/RecipesUnifiedFeedCard';
import { ViralRecipesFeedCard } from '../../components/recipes/ViralRecipesFeedCard';
import { ViralRecipesFeedModeDropdown } from '../../components/recipes/ViralRecipesFeedModeDropdown';
import { RecipesTabFilterBar, RecipesTabFiltersEmptyState } from '../../components/RecipesTabFilterBar';
import { RecipesEmptyState } from '../../components/RecipesEmptyState';
import { RECIPES_COPY } from '../../config/recipesCopy';
import { THEME, isViralRecipesConfigured } from '../../config/appConfig';
import {
  applyRecipesTabFilters,
  discoveryRecipeServingOverrideId,
  recipesTabNarrowingFiltersActive,
  recipesTabPeopleTargetServings,
  type RecipesTabRow,
} from '../../config/recipesTabFilters';
import { useRecipesTabFilters } from '../../hooks/useRecipesTabFilters';
import { usePantryDiscoverySuggestions } from '../../hooks/usePantryDiscoverySuggestions';
import { useViralRecipes } from '../../hooks/useViralRecipes';
import { useViralRecipeOpen } from '../../hooks/useViralRecipeOpen';
import { useApp } from '../../context/AppContext';
import { buildRecipesTabCatalogRows } from '../../lib/recipes/recipesTabCatalog';
import { buildUnifiedRecipesFeed } from '../../lib/recipes/unifiedFeed';
import { buildMyRecipesFeedRows, buildViralFeedCardModels } from '../../lib/recipes/viralFeedRows';
import { RECIPE_SOURCES } from '../../config/recipeSources';
import {
  isClassicRecipesFeedMode,
  isViralRecipesCategory,
  VIRAL_RECIPES_COPY,
  type ViralRecipesFeedMode,
} from '../../config/viralRecipes';
import { MEALDB_COPY } from '../../config/mealdb';
import { useMealDbRecipes } from '../../hooks/useMealDbRecipes';
import { RecipeImportFromShareParams } from '../../components/recipes/RecipeImportFromLink';
import { RECIPE_IMPORT_COPY } from '../../config/recipeImport';

export default function RecipesScreen() {
  const params = useLocalSearchParams<{ recipeId?: string; url?: string; text?: string; import?: string }>();
  const {
    pantry,
    session,
    demoMode,
    openAuthSheet,
    saveLinkImportedRecipe,
    servingOverrides,
    setServingOverride,
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
    refreshLibraryRecipes,
    libraryRecipesLoading,
  } = useApp();
  const routeRecipeId =
    typeof params.recipeId === 'string' && params.recipeId ? params.recipeId : null;
  const [pickedDetailRow, setPickedDetailRow] = useState<RecipesTabRow | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedMode, setFeedMode] = useState<ViralRecipesFeedMode>('viral');
  const viralFeedEnabled = RECIPE_SOURCES.viralRecipesPrimaryFeed && isViralRecipesConfigured();
  const viralCategory = isViralRecipesCategory(feedMode) ? feedMode : 'viral';
  const showClassicRecipesFeed = viralFeedEnabled && isClassicRecipesFeedMode(feedMode);
  const { items: viralItems, loading: viralLoading, error: viralError } = useViralRecipes(
    session,
    viralCategory,
    { enabled: viralFeedEnabled && isViralRecipesCategory(feedMode) },
  );
  const {
    rows: mealDbRows,
    loading: mealDbLoading,
    error: mealDbError,
    refreshMealDb,
  } = useMealDbRecipes(pantry, { enabled: showClassicRecipesFeed });

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
  const {
    suggestions: discoverySuggestions,
    loading: discoveryLoading,
    error: discoveryError,
    refreshDiscovery,
  } = usePantryDiscoverySuggestions(pantry, session, {
    enabled: RECIPE_SOURCES.recipeApiEnabled,
  });

  function openDetail(row: RecipesTabRow) {
    setPickedDetailRow(row);
    onboarding.notifyTutorialStepComplete('recipes');
  }

  const kitchenRecipes = useMemo(() => feedKitchenRecipes, [feedKitchenRecipes]);

  const myRecipesBaseRows = useMemo(
    () =>
      buildMyRecipesFeedRows({
        kitchenRecipes,
        pantryMatches: pantryRecipeMatches,
      }),
    [kitchenRecipes, pantryRecipeMatches],
  );

  const filterBaseRows = useMemo((): RecipesTabRow[] => {
    if (viralFeedEnabled && feedMode === 'my_recipes') {
      return myRecipesBaseRows;
    }
    const kitchenOnly = buildRecipesTabCatalogRows({
      kitchenRecipes,
      pantryMatches: pantryRecipeMatches,
      discoverySuggestions: [],
    });
    if (discoverySuggestions.length === 0) return kitchenOnly;
    return buildRecipesTabCatalogRows({
      kitchenRecipes,
      pantryMatches: pantryRecipeMatches,
      discoverySuggestions,
    });
  }, [
    discoverySuggestions,
    feedMode,
    kitchenRecipes,
    myRecipesBaseRows,
    pantryRecipeMatches,
    viralFeedEnabled,
  ]);

  const filteredRows = useMemo(() => {
    const narrowed = applyRecipesTabFilters(filterBaseRows, filters);
    return buildUnifiedRecipesFeed(narrowed, searchQuery, { diversitySeed: feedDiversitySeed });
  }, [filterBaseRows, filters, searchQuery, feedDiversitySeed]);

  const classicRecipeRows = useMemo(() => {
    if (!showClassicRecipesFeed) return [];
    const haystack = searchQuery.trim().toLowerCase();
    if (!haystack) return mealDbRows;
    return mealDbRows.filter((row) => row.recipe.name.toLowerCase().includes(haystack));
  }, [mealDbRows, searchQuery, showClassicRecipesFeed]);

  const viralCardModels = useMemo(() => {
    if (!viralFeedEnabled || feedMode === 'my_recipes' || showClassicRecipesFeed) return [];
    const haystack = searchQuery.trim().toLowerCase();
    const filtered = haystack
      ? viralItems.filter((item) => item.title.toLowerCase().includes(haystack))
      : viralItems;
    return buildViralFeedCardModels(filtered, kitchenRecipes, pantryRecipeMatches);
  }, [
    feedMode,
    kitchenRecipes,
    pantryRecipeMatches,
    searchQuery,
    showClassicRecipesFeed,
    viralFeedEnabled,
    viralItems,
  ]);

  function showDifferentIdeas() {
    setFeedDiversitySeed((value) => value + 1);
    if (showClassicRecipesFeed) {
      refreshMealDb();
      return;
    }
    if (RECIPE_SOURCES.recipeApiEnabled) {
      refreshDiscovery();
    } else {
      refreshLibraryRecipes();
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
    for (const { recipe } of discoverySuggestions) {
      updates[discoveryRecipeServingOverrideId(recipe.id)] = peopleTargetServings;
    }
    applyServingOverridesBatch(updates);
  }, [applyServingOverridesBatch, discoverySuggestions, kitchenRecipes, peopleTargetServings]);

  const detailServings = useMemo(() => {
    if (!detailRow) return 4;
    if (detailRow.kind === 'kitchen') {
      const recipe = detailRow.recipe;
      return servingOverrides[recipe.id] ?? recipe.servings;
    }
    return servingOverrides[discoveryRecipeServingOverrideId(detailRow.recipe.id)] ?? detailRow.recipe.servings;
  }, [detailRow, servingOverrides]);

  function setDetailServings(next: number) {
    if (!detailRow) return;
    if (detailRow.kind === 'kitchen') {
      setServingOverride(detailRow.recipe.id, next);
      return;
    }
    setServingOverride(discoveryRecipeServingOverrideId(detailRow.recipe.id), next);
  }

  const showMyRecipesFeed = viralFeedEnabled && feedMode === 'my_recipes';
  const showLegacyKitchenFeed = !viralFeedEnabled;

  const hasUnfilteredResults = showMyRecipesFeed
    ? myRecipesBaseRows.length > 0
    : showClassicRecipesFeed
      ? mealDbRows.length > 0
      : showLegacyKitchenFeed
        ? filterBaseRows.length > 0
        : viralCardModels.length > 0;
  const showFilterEmpty =
    showMyRecipesFeed &&
    recipesTabNarrowingFiltersActive(filters) &&
    hasUnfilteredResults &&
    filteredRows.length === 0 &&
    !searchQuery.trim();

  const showCatalogEmpty =
    !showFilterEmpty &&
    !discoveryLoading &&
    !viralLoading &&
    !mealDbLoading &&
    !hasUnfilteredResults &&
    !searchQuery.trim();

  const showSearchEmpty =
    !discoveryLoading &&
    !viralLoading &&
    !mealDbLoading &&
    hasUnfilteredResults &&
    (showMyRecipesFeed
      ? filteredRows.length === 0
      : showClassicRecipesFeed
        ? classicRecipeRows.length === 0
        : viralCardModels.length === 0) &&
    Boolean(searchQuery.trim());

  const showSignInOnImportError =
    Boolean(viralOpenState?.importError) &&
    viralOpenState?.importError === RECIPE_IMPORT_COPY.guestSignInMessage &&
    !session &&
    !demoMode;

  return (
    <ScrollView className="flex-1 bg-paper px-4 pb-8">
      <Card
        className="mt-4"
        title={viralFeedEnabled ? VIRAL_RECIPES_COPY.feedTitle : RECIPES_COPY.cookNowCard.title}
        subtitle={
          viralFeedEnabled ? VIRAL_RECIPES_COPY.feedSubtitle : RECIPES_COPY.cookNowCard.subtitle
        }
      >
        <View className="mt-2 flex-row items-center gap-2">
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={RECIPES_COPY.discoveryPanel.searchPlaceholder}
            placeholderTextColor={THEME.muted}
            className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search recipes"
          />
          {viralFeedEnabled ? (
            <ViralRecipesFeedModeDropdown value={feedMode} onChange={setFeedMode} />
          ) : null}
        </View>
        <RecipeImportFromShareParams
          url={typeof params.url === 'string' ? params.url : undefined}
          text={typeof params.text === 'string' ? params.text : undefined}
          autoRun={autoStartSharedImport}
        />
        {showMyRecipesFeed || showLegacyKitchenFeed ? (
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
        {(showMyRecipesFeed || showLegacyKitchenFeed) && !viralFeedEnabled ? (
          <Pressable
            onPress={showDifferentIdeas}
            disabled={discoveryLoading || libraryRecipesLoading}
            className="mt-2 min-h-[40px] items-center justify-center rounded-lg px-3 py-2"
            accessibilityRole="button"
            accessibilityLabel={RECIPES_COPY.cookNowCard.showDifferentIdeas}
          >
            <Text className="text-sm font-semibold text-primary">
              {discoveryLoading || libraryRecipesLoading
                ? RECIPES_COPY.discoveryPanel.searching
                : RECIPES_COPY.cookNowCard.showDifferentIdeas}
            </Text>
          </Pressable>
        ) : null}
      </Card>

      {discoveryLoading ? (
        <View className="mt-4 flex-row items-center gap-2">
          <ActivityIndicator color={THEME.primary} />
          <Text className="text-sm text-muted">{RECIPES_COPY.moreIdeasCard.loading}</Text>
        </View>
      ) : null}
      {!discoveryLoading && discoveryError ? (
        <Text className="mt-3 text-sm text-muted">{discoveryError}</Text>
      ) : null}

      {viralFeedEnabled && isViralRecipesCategory(feedMode) && viralLoading ? (
        <View className="mt-4 flex-row items-center gap-2">
          <ActivityIndicator color={THEME.primary} />
          <Text className="text-sm text-muted">{VIRAL_RECIPES_COPY.loading}</Text>
        </View>
      ) : null}
      {viralFeedEnabled && isViralRecipesCategory(feedMode) && !viralLoading && viralError ? (
        <Text className="mt-3 text-sm text-muted">{viralError}</Text>
      ) : null}

      {showClassicRecipesFeed && mealDbLoading ? (
        <View className="mt-4 flex-row items-center gap-2">
          <ActivityIndicator color={THEME.primary} />
          <Text className="text-sm text-muted">{MEALDB_COPY.loading}</Text>
        </View>
      ) : null}
      {showClassicRecipesFeed && !mealDbLoading && mealDbError ? (
        <Text className="mt-3 text-sm text-muted">{mealDbError}</Text>
      ) : null}

      {showCatalogEmpty ? <RecipesEmptyState pantryEmpty={false} /> : null}
      {showFilterEmpty ? <RecipesTabFiltersEmptyState onClearAll={clearAllFilters} /> : null}
      {showSearchEmpty ? (
        <Text className="mt-4 text-sm text-muted">{RECIPES_COPY.discoveryPanel.noFilterResults}</Text>
      ) : null}

      {showClassicRecipesFeed
        ? classicRecipeRows.map((row) => (
            <RecipesUnifiedFeedCard
              key={row.recipe.id}
              row={row}
              onOpen={() => openDetail(row)}
            />
          ))
        : null}

      {viralFeedEnabled && isViralRecipesCategory(feedMode)
        ? viralCardModels.map((model) => (
            <ViralRecipesFeedCard
              key={model.videoId}
              model={model}
              onOpen={() => {
                openViralItem(model.item);
                onboarding.notifyTutorialStepComplete('recipes');
              }}
            />
          ))
        : null}

      {showMyRecipesFeed || showLegacyKitchenFeed
        ? filteredRows.map((row) => (
            <RecipesUnifiedFeedCard
              key={row.kind === 'kitchen' ? row.recipe.id : `api-${row.recipe.id}`}
              row={row}
              onOpen={() => openDetail(row)}
            />
          ))
        : null}

      <RecipeDetailSheet
        visible={detailRow != null}
        row={detailRow}
        match={detailMatch}
        servings={detailServings}
        batchCalculatorEnabled={Boolean(featureFlags.batchCalculator)}
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
        onChangeServings={setDetailServings}
        onAddMissingKitchen={addMissingRecipeIngredientsToGrocery}
        onAddMissingDiscovery={addMissingDiscoveryRecipeIngredientsToGrocery}
        isOnMealPlan={isOnMealPlan}
        onToggleKitchen={(recipeId) => void toggleMealPlanKitchenRecipe(recipeId)}
        onToggleDiscovery={(recipe) => void toggleMealPlanDiscoveryRecipe(recipe)}
      />
    </ScrollView>
  );
}
