import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Card } from '../../components/Card';
import { RecipeDetailSheet } from '../../components/recipes/RecipeDetailSheet';
import { RecipesUnifiedFeedCard } from '../../components/recipes/RecipesUnifiedFeedCard';
import { RecipesTabFilterBar, RecipesTabFiltersEmptyState } from '../../components/RecipesTabFilterBar';
import { RecipesEmptyState } from '../../components/RecipesEmptyState';
import { RECIPES_COPY } from '../../config/recipesCopy';
import { THEME } from '../../config/appConfig';
import {
  applyRecipesTabFilters,
  discoveryRecipeServingOverrideId,
  recipesTabNarrowingFiltersActive,
  recipesTabPeopleTargetServings,
  type RecipesTabRow,
} from '../../config/recipesTabFilters';
import { useRecipesTabFilters } from '../../hooks/useRecipesTabFilters';
import { usePantryDiscoverySuggestions } from '../../hooks/usePantryDiscoverySuggestions';
import { useApp } from '../../context/AppContext';
import { buildRecipesTabCatalogRows } from '../../lib/recipes/recipesTabCatalog';
import { buildUnifiedRecipesFeed } from '../../lib/recipes/unifiedFeed';
import { kitchenRecipesForPantryMatch } from '../../lib/recipeMatch/kitchenCatalogMerge';
import { RecipeImportFromLink } from '../../components/recipes/RecipeImportFromLink';
import { RECIPE_IMPORT_COPY } from '../../config/recipeImport';

export default function RecipesScreen() {
  const params = useLocalSearchParams<{ recipeId?: string; url?: string; text?: string }>();
  const {
    recipes,
    pantry,
    session,
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
  } = useApp();
  const routeRecipeId =
    typeof params.recipeId === 'string' && params.recipeId ? params.recipeId : null;
  const [pickedDetailRow, setPickedDetailRow] = useState<RecipesTabRow | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const sharedImportUrl = useMemo(() => {
    const direct = typeof params.url === 'string' ? params.url : '';
    if (direct.trim()) return direct.trim();
    const text = typeof params.text === 'string' ? params.text : '';
    const match = text.match(/https?:\/\/[^\s]+/i);
    return match ? match[0] : '';
  }, [params.text, params.url]);
  const [feedDiversitySeed, setFeedDiversitySeed] = useState(0);
  const { filters, setFilter, clearAllFilters } = useRecipesTabFilters();
  const pantryEmpty = pantry.length === 0;
  const {
    suggestions: discoverySuggestions,
    loading: discoveryLoading,
    error: discoveryError,
    refreshDiscovery,
  } = usePantryDiscoverySuggestions(pantry, session, { enabled: true });

  function openDetail(row: RecipesTabRow) {
    setPickedDetailRow(row);
    onboarding.notifyTutorialStepComplete('recipes');
  }

  const kitchenRecipes = useMemo(() => kitchenRecipesForPantryMatch(recipes), [recipes]);

  const filterBaseRows = useMemo((): RecipesTabRow[] => {
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
  }, [discoverySuggestions, kitchenRecipes, pantryRecipeMatches]);

  const filteredRows = useMemo(() => {
    const narrowed = applyRecipesTabFilters(filterBaseRows, filters);
    return buildUnifiedRecipesFeed(narrowed, searchQuery, { diversitySeed: feedDiversitySeed });
  }, [filterBaseRows, filters, searchQuery, feedDiversitySeed]);

  function showDifferentIdeas() {
    setFeedDiversitySeed((value) => value + 1);
    refreshDiscovery();
  }

  const detailRow = useMemo(() => {
    if (pickedDetailRow) return pickedDetailRow;
    if (!routeRecipeId) return null;
    return (
      filterBaseRows.find(
        (candidate) => candidate.kind === 'kitchen' && candidate.recipe.id === routeRecipeId,
      ) ?? null
    );
  }, [filterBaseRows, pickedDetailRow, routeRecipeId]);

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

  const hasUnfilteredResults = filterBaseRows.length > 0;
  const showFilterEmpty =
    recipesTabNarrowingFiltersActive(filters) &&
    hasUnfilteredResults &&
    filteredRows.length === 0 &&
    !searchQuery.trim();

  const showCatalogEmpty =
    !showFilterEmpty && !discoveryLoading && filterBaseRows.length === 0 && !searchQuery.trim();

  const showSearchEmpty =
    !discoveryLoading &&
    filterBaseRows.length > 0 &&
    filteredRows.length === 0 &&
    Boolean(searchQuery.trim());

  return (
    <ScrollView className="flex-1 bg-paper px-4 pb-8">
      <Card
        className="mt-4"
        title={RECIPES_COPY.cookNowCard.title}
        subtitle={RECIPES_COPY.cookNowCard.subtitle}
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
        </View>
        <Text className="mt-2 text-xs font-semibold text-muted">{RECIPE_IMPORT_COPY.importButton}</Text>
        <RecipeImportFromLink key={sharedImportUrl || 'default'} initialUrl={sharedImportUrl} />
        <RecipesTabFilterBar
          baseRows={filterBaseRows}
          filters={filters}
          onSetFilter={setFilter}
          onClearAll={clearAllFilters}
        />
        {pantryEmpty ? (
          <Text className="mt-2 text-xs text-muted">{RECIPES_COPY.cookNowCard.emptyPantryBrowseHint}</Text>
        ) : null}
        <Pressable
          onPress={showDifferentIdeas}
          disabled={discoveryLoading}
          className="mt-3 min-h-[44px] items-center justify-center rounded-xl border border-primary bg-primary-light px-4 py-3"
          accessibilityRole="button"
          accessibilityLabel={RECIPES_COPY.cookNowCard.showDifferentIdeas}
        >
          <Text className="text-sm font-bold text-primary-dark">
            {discoveryLoading ? RECIPES_COPY.discoveryPanel.searching : RECIPES_COPY.cookNowCard.showDifferentIdeas}
          </Text>
        </Pressable>
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

      {showCatalogEmpty ? <RecipesEmptyState pantryEmpty={false} /> : null}
      {showFilterEmpty ? <RecipesTabFiltersEmptyState onClearAll={clearAllFilters} /> : null}
      {showSearchEmpty ? (
        <Text className="mt-4 text-sm text-muted">{RECIPES_COPY.discoveryPanel.noFilterResults}</Text>
      ) : null}

      {filteredRows.map((row) => (
        <RecipesUnifiedFeedCard
          key={row.kind === 'kitchen' ? row.recipe.id : `api-${row.recipe.id}`}
          row={row}
          onOpen={() => openDetail(row)}
          isOnMealPlan={isOnMealPlan}
          onToggleKitchen={(recipeId) => void toggleMealPlanKitchenRecipe(recipeId)}
          onToggleDiscovery={(recipe) => void toggleMealPlanDiscoveryRecipe(recipe)}
          onAddMissingKitchen={addMissingRecipeIngredientsToGrocery}
          onAddMissingDiscovery={addMissingDiscoveryRecipeIngredientsToGrocery}
        />
      ))}

      <RecipeDetailSheet
        visible={detailRow != null}
        row={detailRow}
        match={detailRow?.match}
        servings={detailServings}
        batchCalculatorEnabled={Boolean(featureFlags.batchCalculator)}
        onClose={() => {
          setPickedDetailRow(null);
          if (routeRecipeId) router.replace('/recipes');
        }}
        onChangeServings={setDetailServings}
        onAddMissingKitchen={addMissingRecipeIngredientsToGrocery}
        onAddMissingDiscovery={addMissingDiscoveryRecipeIngredientsToGrocery}
      />
    </ScrollView>
  );
}
