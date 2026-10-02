import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Card } from '../../components/Card';
import { RecipeDetailSheet } from '../../components/recipes/RecipeDetailSheet';
import { RecipesUnifiedFeedCard } from '../../components/recipes/RecipesUnifiedFeedCard';
import { RecipesTabFilterBar, RecipesTabFiltersEmptyState } from '../../components/RecipesTabFilterBar';
import { RecipesEmptyState } from '../../components/RecipesEmptyState';
import { RECIPES_TAB, THEME } from '../../config/appConfig';
import { RECIPES_TAB_THIN_PANTRY_ITEM_MAX } from '../../config/recipeMatching';
import { RECIPES_COPY } from '../../config/recipesCopy';
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
import { splitRankedMatchesForRecipesTab } from '../../lib/recipes/recipesFeedTiers';
import { buildUnifiedRecipesFeed, dedupeRecipesTabRows } from '../../lib/recipes/unifiedFeed';
import type { RecipePantryMatch } from '../../lib/recipeMatch';
import { kitchenRecipesForPantryMatch } from '../../lib/recipeMatch/kitchenCatalogMerge';
import type { Recipe } from '../../types/mealprep';

function rankKitchenRecipesByPantry(kitchenRecipes: Recipe[], ranked: RecipePantryMatch[]): Recipe[] {
  const rankedIds = ranked.map((m) => m.recipeId);
  const idSet = new Set(rankedIds);
  const list = kitchenRecipes.filter((r) => idSet.has(r.id));
  list.sort((a, b) => rankedIds.indexOf(a.id) - rankedIds.indexOf(b.id));
  return list;
}

export default function RecipesScreen() {
  const params = useLocalSearchParams<{ recipeId?: string }>();
  const {
    recipes,
    pantry,
    session,
    servingOverrides,
    setServingOverride,
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
  const [feedDiversitySeed, setFeedDiversitySeed] = useState(0);
  const { filters, setFilter, clearAllFilters } = useRecipesTabFilters();
  const minPantryMatchPercent = RECIPES_TAB.defaultMinPercent;
  const pantryEmpty = pantry.length === 0;
  const discoveryEnabled = !pantryEmpty;
  const {
    suggestions: discoverySuggestions,
    closeSuggestions: discoveryCloseSuggestions,
    loading: discoveryLoading,
    error: discoveryError,
    refreshDiscovery,
  } = usePantryDiscoverySuggestions(pantry, session, { enabled: discoveryEnabled });

  function openDetail(row: RecipesTabRow) {
    setPickedDetailRow(row);
    onboarding.notifyTutorialStepComplete('recipes');
  }

  const kitchenRecipes = useMemo(() => kitchenRecipesForPantryMatch(recipes), [recipes]);

  const tieredBaseRows = useMemo(() => {
    if (pantryEmpty) {
      return { canMake: [] as RecipesTabRow[], close: [] as RecipesTabRow[] };
    }

    const kitchenSplit = splitRankedMatchesForRecipesTab(pantryRecipeMatches.ranked, {
      minPercent: minPantryMatchPercent,
      pantryItemCount: pantry.length,
    });
    const kitchenCanMake = rankKitchenRecipesByPantry(kitchenRecipes, kitchenSplit.canMake);
    const kitchenClose = rankKitchenRecipesByPantry(kitchenRecipes, kitchenSplit.close);

    const toKitchenRow = (recipe: Recipe): RecipesTabRow => ({
      kind: 'kitchen',
      recipe,
      match:
        pantryRecipeMatches.byRecipeId.get(recipe.id) ??
        ({
          recipeId: recipe.id,
          recipeName: recipe.name,
          totalIngredients: 0,
          matchedCount: 0,
          missingCount: 0,
          percentMatch: 0,
          matched: [],
          missing: [],
        } satisfies RecipePantryMatch),
    });

    const canMake: RecipesTabRow[] = [
      ...kitchenCanMake.map(toKitchenRow),
      ...discoverySuggestions.map((row) => ({
        kind: 'discovery' as const,
        recipe: row.recipe,
        match: row.match,
      })),
    ];
    const close: RecipesTabRow[] = [
      ...kitchenClose.map(toKitchenRow),
      ...discoveryCloseSuggestions.map((row) => ({
        kind: 'discovery' as const,
        recipe: row.recipe,
        match: row.match,
      })),
    ];

    return {
      canMake: dedupeRecipesTabRows(canMake),
      close: dedupeRecipesTabRows(close),
    };
  }, [
    discoveryCloseSuggestions,
    discoverySuggestions,
    kitchenRecipes,
    minPantryMatchPercent,
    pantry.length,
    pantryEmpty,
    pantryRecipeMatches.byRecipeId,
    pantryRecipeMatches.ranked,
  ]);

  const filterBaseRows = useMemo(
    (): RecipesTabRow[] => [...tieredBaseRows.canMake, ...tieredBaseRows.close],
    [tieredBaseRows],
  );

  const filteredCanMakeRows = useMemo(() => {
    const narrowed = applyRecipesTabFilters(tieredBaseRows.canMake, filters);
    return buildUnifiedRecipesFeed(narrowed, searchQuery, { diversitySeed: feedDiversitySeed });
  }, [tieredBaseRows.canMake, filters, searchQuery, feedDiversitySeed]);

  const filteredCloseRows = useMemo(() => {
    const narrowed = applyRecipesTabFilters(tieredBaseRows.close, filters);
    return buildUnifiedRecipesFeed(narrowed, searchQuery, { diversitySeed: feedDiversitySeed });
  }, [tieredBaseRows.close, filters, searchQuery, feedDiversitySeed]);

  function showDifferentIdeas() {
    setFeedDiversitySeed((value) => value + 1);
    refreshDiscovery();
  }

  const detailRow = useMemo(() => {
    if (pickedDetailRow) return pickedDetailRow;
    if (!routeRecipeId || pantryEmpty) return null;
    return (
      filterBaseRows.find(
        (candidate) => candidate.kind === 'kitchen' && candidate.recipe.id === routeRecipeId,
      ) ?? null
    );
  }, [filterBaseRows, pantryEmpty, pickedDetailRow, routeRecipeId]);

  const peopleTargetServings = recipesTabPeopleTargetServings(filters.people);
  useEffect(() => {
    if (peopleTargetServings == null) return;
    for (const recipe of kitchenRecipes) {
      setServingOverride(recipe.id, peopleTargetServings);
    }
    for (const { recipe } of discoverySuggestions) {
      setServingOverride(discoveryRecipeServingOverrideId(recipe.id), peopleTargetServings);
    }
    for (const { recipe } of discoveryCloseSuggestions) {
      setServingOverride(discoveryRecipeServingOverrideId(recipe.id), peopleTargetServings);
    }
  }, [
    discoveryCloseSuggestions,
    discoverySuggestions,
    kitchenRecipes,
    peopleTargetServings,
    setServingOverride,
  ]);

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
    !pantryEmpty &&
    recipesTabNarrowingFiltersActive(filters) &&
    hasUnfilteredResults &&
    filteredCanMakeRows.length === 0 &&
    filteredCloseRows.length === 0 &&
    !searchQuery.trim();

  const showKitchenEmpty =
    pantryEmpty ||
    (!showFilterEmpty &&
      !discoveryLoading &&
      filterBaseRows.length === 0 &&
      !searchQuery.trim());

  const showSearchEmpty =
    !pantryEmpty &&
    !discoveryLoading &&
    filterBaseRows.length > 0 &&
    filteredCanMakeRows.length === 0 &&
    filteredCloseRows.length === 0 &&
    Boolean(searchQuery.trim());

  return (
    <ScrollView className="flex-1 bg-paper px-4 pb-8">
      <Card
        className="mt-4"
        title={RECIPES_COPY.cookNowCard.title}
        subtitle={RECIPES_COPY.cookNowCard.subtitle}
      >
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={RECIPES_COPY.discoveryPanel.searchPlaceholder}
          placeholderTextColor={THEME.muted}
          className="mt-2 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search recipes"
        />
        <RecipesTabFilterBar
          baseRows={filterBaseRows}
          filters={filters}
          onSetFilter={setFilter}
          onClearAll={clearAllFilters}
        />
        {!pantryEmpty && pantry.length <= RECIPES_TAB_THIN_PANTRY_ITEM_MAX ? (
          <Text className="mt-2 text-xs text-muted">{RECIPES_COPY.cookNowCard.thinPantryHint}</Text>
        ) : null}
        {!pantryEmpty ? (
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
        ) : null}
      </Card>

      {discoveryLoading && !pantryEmpty ? (
        <View className="mt-4 flex-row items-center gap-2">
          <ActivityIndicator color={THEME.primary} />
          <Text className="text-sm text-muted">{RECIPES_COPY.moreIdeasCard.loading}</Text>
        </View>
      ) : null}
      {!discoveryLoading && discoveryError ? (
        <Text className="mt-3 text-sm text-muted">{discoveryError}</Text>
      ) : null}

      {showKitchenEmpty ? <RecipesEmptyState pantryEmpty={pantryEmpty} /> : null}
      {showFilterEmpty ? <RecipesTabFiltersEmptyState onClearAll={clearAllFilters} /> : null}
      {showSearchEmpty ? (
        <Text className="mt-4 text-sm text-muted">{RECIPES_COPY.discoveryPanel.noFilterResults}</Text>
      ) : null}

      {filteredCanMakeRows.map((row) => (
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

      {filteredCloseRows.length > 0 ? (
        <View className="mt-5">
          <Text className="text-sm font-bold text-ink">{RECIPES_COPY.unifiedFeed.closeSectionTitle}</Text>
          <Text className="mt-0.5 text-xs text-muted">{RECIPES_COPY.unifiedFeed.closeSectionSubtitle}</Text>
          {filteredCloseRows.map((row) => (
            <RecipesUnifiedFeedCard
              key={`close-${row.kind === 'kitchen' ? row.recipe.id : `api-${row.recipe.id}`}`}
              row={row}
              onOpen={() => openDetail(row)}
              isOnMealPlan={isOnMealPlan}
              onToggleKitchen={(recipeId) => void toggleMealPlanKitchenRecipe(recipeId)}
              onToggleDiscovery={(recipe) => void toggleMealPlanDiscoveryRecipe(recipe)}
              onAddMissingKitchen={addMissingRecipeIngredientsToGrocery}
              onAddMissingDiscovery={addMissingDiscoveryRecipeIngredientsToGrocery}
            />
          ))}
        </View>
      ) : null}

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
