import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { Card } from '../../components/Card';
import { RecipeDetailSheet } from '../../components/recipes/RecipeDetailSheet';
import { RecipesUnifiedFeedCard } from '../../components/recipes/RecipesUnifiedFeedCard';
import { RecipesTabFilterBar, RecipesTabFiltersEmptyState } from '../../components/RecipesTabFilterBar';
import { RecipesEmptyState } from '../../components/RecipesEmptyState';
import { RECIPES_TAB, THEME } from '../../config/appConfig';
import { DEFAULT_MIN_MATCHED_INGREDIENTS } from '../../config/recipeMatching';
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
import { buildUnifiedRecipesFeed, dedupeRecipesTabRows } from '../../lib/recipes/unifiedFeed';
import {
  filterRankedMatchesWithPartialFallback,
  type RecipePantryMatch,
} from '../../lib/recipeMatch';
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
  const { filters, setFilter, clearAllFilters } = useRecipesTabFilters();
  const minPantryMatchPercent = RECIPES_TAB.defaultMinPercent;
  const pantryEmpty = pantry.length === 0;
  const discoveryEnabled = !pantryEmpty;
  const {
    suggestions: discoverySuggestions,
    loading: discoveryLoading,
    error: discoveryError,
  } = usePantryDiscoverySuggestions(pantry, session, { enabled: discoveryEnabled });

  function openDetail(row: RecipesTabRow) {
    setPickedDetailRow(row);
    onboarding.notifyTutorialStepComplete('recipes');
  }

  const kitchenRecipes = useMemo(() => kitchenRecipesForPantryMatch(recipes), [recipes]);

  const baseKitchenRecipes = useMemo(() => {
    if (pantryEmpty) return [];
    const minMatchedCount = RECIPES_TAB.hideZeroPantryMatches ? DEFAULT_MIN_MATCHED_INGREDIENTS : 0;
    const { matches: ranked } = filterRankedMatchesWithPartialFallback(
      pantryRecipeMatches.ranked,
      'all',
      minPantryMatchPercent,
      {
        minMatchedCount,
        pantryItemCount: pantry.length,
      },
    );
    return rankKitchenRecipesByPantry(kitchenRecipes, ranked);
  }, [minPantryMatchPercent, pantry.length, pantryEmpty, pantryRecipeMatches.ranked, kitchenRecipes]);

  const baseDiscoverySuggestions = useMemo(() => {
    if (pantryEmpty) return [];
    const { matches } = filterRankedMatchesWithPartialFallback(
      discoverySuggestions.map((row) => row.match),
      'all',
      minPantryMatchPercent,
      { pantryItemCount: pantry.length },
    );
    const allowed = new Set(matches.map((m) => m.recipeId));
    return discoverySuggestions.filter((row) => allowed.has(row.match.recipeId));
  }, [discoverySuggestions, minPantryMatchPercent, pantry.length, pantryEmpty]);

  const filterBaseRows = useMemo((): RecipesTabRow[] => {
    const kitchenRows: RecipesTabRow[] = baseKitchenRecipes.map((recipe) => ({
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
    }));
    const discoveryRows: RecipesTabRow[] = baseDiscoverySuggestions.map((row) => ({
      kind: 'discovery',
      recipe: row.recipe,
      match: row.match,
    }));
    return dedupeRecipesTabRows([...kitchenRows, ...discoveryRows]);
  }, [baseDiscoverySuggestions, baseKitchenRecipes, pantryRecipeMatches.byRecipeId]);

  const filteredRows = useMemo(() => {
    const narrowed = applyRecipesTabFilters(filterBaseRows, filters);
    return buildUnifiedRecipesFeed(narrowed, searchQuery);
  }, [filterBaseRows, filters, searchQuery]);

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
    for (const { recipe } of baseDiscoverySuggestions) {
      setServingOverride(discoveryRecipeServingOverrideId(recipe.id), peopleTargetServings);
    }
  }, [baseDiscoverySuggestions, kitchenRecipes, peopleTargetServings, setServingOverride]);

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
    filteredRows.length === 0 &&
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
    filteredRows.length === 0 &&
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
