import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Card } from '../../components/Card';
import { DiscoverRecipesPanel } from '../../components/DiscoverRecipesPanel';
import { FilterChips } from '../../components/FilterChips';
import { RecipePantryMatchBadge } from '../../components/RecipePantryMatch';
import { RecipesEmptyState } from '../../components/RecipesEmptyState';
import { GuestSaveNudge } from '../../components/GuestSaveNudge';
import { RECIPES_TAB, THEME } from '../../config/appConfig';
import { DEFAULT_MIN_MATCHED_INGREDIENTS, DEFAULT_MIN_PANTRY_MATCH_PERCENT } from '../../config/recipeMatching';
import { RECIPES_COPY, type RecipesPantryFilterCopyId } from '../../config/recipesCopy';
import { usePantryDiscoverySuggestions } from '../../hooks/usePantryDiscoverySuggestions';
import { useApp } from '../../context/AppContext';
import { splitDiscoveryCookNowLists } from '../../lib/recipeDiscovery/pantryCookNow';
import type { PantryDiscoverySuggestion } from '../../lib/recipeDiscovery/pantrySuggestions';
import {
  filterRankedMatches,
  type PantryMatchIndex,
  type RecipePantryFilterMode,
} from '../../lib/recipeMatch';
import { nutritionLabel } from '../../lib/nutrition';
import type { Recipe } from '../../types/mealprep';

const FILTER_OPTIONS: { id: RecipePantryFilterMode; label: string }[] = (
  ['best_match', 'have_all', 'missing_1_2', 'all'] as RecipesPantryFilterCopyId[]
).map((id) => ({ id, label: RECIPES_COPY.pantryFilterLabels[id] }));

const MIN_PERCENT_CHIPS = [0, 50, 70, 90] as const;

function DiscoveryRecipeListSection({
  title,
  subtitle,
  list,
  isOnMealPlan,
  toggleMealPlanDiscoveryRecipe,
}: {
  title: string;
  subtitle: string;
  list: PantryDiscoverySuggestion[];
  isOnMealPlan: (recipeApiId: number) => boolean;
  toggleMealPlanDiscoveryRecipe: (
    item: PantryDiscoverySuggestion['recipe'],
  ) => Promise<void>;
}) {
  if (list.length === 0) return null;
  return (
    <>
      <Text className="mb-1 mt-4 text-sm font-bold uppercase tracking-wide text-muted">{title}</Text>
      <Text className="mb-2 text-xs text-muted">{subtitle}</Text>
      {list.map(({ recipe, match }) => {
        const onPlan = isOnMealPlan(recipe.id);
        return (
          <Pressable key={`discovery-${recipe.id}`} onPress={() => router.push(`/discover-recipes/${recipe.id}`)}>
            <Card className="mb-3">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-2">
                  <Text className="text-base font-bold text-ink">{recipe.name}</Text>
                  <RecipePantryMatchBadge match={match} />
                </View>
                <Pressable
                  onPress={() => void toggleMealPlanDiscoveryRecipe(recipe)}
                  className={`rounded-full px-3 py-1 ${onPlan ? 'bg-primary' : 'border border-border bg-paper'}`}
                >
                  <Text className={`text-xs font-bold ${onPlan ? 'text-on-primary' : 'text-muted'}`}>
                    {onPlan ? RECIPES_COPY.mealPlanChip.onPlan : RECIPES_COPY.mealPlanChip.add}
                  </Text>
                </Pressable>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </>
  );
}

function RecipeListSection({
  title,
  subtitle,
  list,
  activeId,
  setActiveId,
  pantryRecipeMatches,
  isOnMealPlan,
  toggleMealPlanKitchenRecipe,
}: {
  title: string;
  subtitle: string;
  list: Recipe[];
  activeId: string;
  setActiveId: (id: string) => void;
  pantryRecipeMatches: PantryMatchIndex;
  isOnMealPlan: (options: { recipeSlug?: string; recipeApiId?: number }) => boolean;
  toggleMealPlanKitchenRecipe: (recipeId: string) => Promise<void>;
}) {
  if (list.length === 0) return null;
  return (
    <>
      <Text className="mb-1 mt-4 text-sm font-bold uppercase tracking-wide text-muted">{title}</Text>
      <Text className="mb-2 text-xs text-muted">{subtitle}</Text>
      {list.map((recipe) => {
        const onPlan = isOnMealPlan({ recipeSlug: recipe.id });
        const match = pantryRecipeMatches.byRecipeId.get(recipe.id);
        return (
          <Pressable key={recipe.id} onPress={() => setActiveId(recipe.id)}>
            <Card className={`mb-3 ${activeId === recipe.id ? 'border-primary' : ''}`}>
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-2">
                  <Text className="text-xs font-semibold uppercase text-primary">{recipe.tag}</Text>
                  <Text className="text-base font-bold text-ink">{recipe.name}</Text>
                  <Text className="mt-1 text-sm text-muted">{recipe.description}</Text>
                  <RecipePantryMatchBadge match={match} />
                  <Text className="mt-2 text-xs text-muted">
                    {recipe.servings} servings · {recipe.minutes} min · {nutritionLabel(recipe)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => void toggleMealPlanKitchenRecipe(recipe.id)}
                  className={`rounded-full px-3 py-1 ${onPlan ? 'bg-primary' : 'border border-border bg-paper'}`}
                >
                  <Text className={`text-xs font-bold ${onPlan ? 'text-on-primary' : 'text-muted'}`}>
                    {onPlan ? RECIPES_COPY.mealPlanChip.onPlan : RECIPES_COPY.mealPlanChip.add}
                  </Text>
                </Pressable>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </>
  );
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
    mealPlan,
    toggleMealPlanDiscoveryRecipe,
    isOnMealPlan,
    toggleMealPlanKitchenRecipe,
    onboarding,
  } = useApp();
  const [activeId, setActiveId] = useState('');
  const [pantryFilter, setPantryFilter] = useState<RecipePantryFilterMode>('best_match');
  const [minPercent, setMinPercent] = useState(DEFAULT_MIN_PANTRY_MATCH_PERCENT);
  const pantryEmpty = pantry.length === 0;
  const discoveryEnabled = !pantryEmpty;
  const {
    suggestions: discoverySuggestions,
    loading: discoveryLoading,
    error: discoveryError,
  } = usePantryDiscoverySuggestions(pantry, session, { enabled: discoveryEnabled, minPercent });
  const activeMealCount = mealPlan.filter((m) => !m.made).length;

  function selectRecipe(recipeId: string) {
    setActiveId(recipeId);
    onboarding.notifyTutorialStepComplete('recipes');
  }

  const filteredKitchenRecipes = useMemo(() => {
    if (pantryEmpty) return [];
    const mode = pantryFilter === 'best_match' ? 'all' : pantryFilter;
    const minMatchedCount =
      pantryFilter === 'all'
        ? 0
        : RECIPES_TAB.hideZeroPantryMatches
          ? DEFAULT_MIN_MATCHED_INGREDIENTS
          : 0;
    const ranked = filterRankedMatches(pantryRecipeMatches.ranked, mode, minPercent, {
      minMatchedCount,
      pantryItemCount: pantry.length,
    });
    const rankedIds = ranked.map((m) => m.recipeId);
    const idSet = new Set(rankedIds);
    const list = recipes.filter((r) => idSet.has(r.id));
    list.sort((a, b) => rankedIds.indexOf(a.id) - rankedIds.indexOf(b.id));
    return list;
  }, [minPercent, pantry.length, pantryEmpty, pantryFilter, pantryRecipeMatches.ranked, recipes]);

  const cookNowRecipes = useMemo(
    () =>
      filteredKitchenRecipes.filter((r) => (pantryRecipeMatches.byRecipeId.get(r.id)?.missingCount ?? 1) === 0),
    [filteredKitchenRecipes, pantryRecipeMatches.byRecipeId],
  );

  const needItemsRecipes = useMemo(
    () =>
      filteredKitchenRecipes.filter((r) => (pantryRecipeMatches.byRecipeId.get(r.id)?.missingCount ?? 0) > 0),
    [filteredKitchenRecipes, pantryRecipeMatches.byRecipeId],
  );

  const filteredDiscoverySuggestions = useMemo(() => {
    if (pantryEmpty) return [];
    return discoverySuggestions.filter(
      (row) =>
        row.match.percentMatch >= minPercent && row.match.matchedCount >= DEFAULT_MIN_MATCHED_INGREDIENTS,
    );
  }, [discoverySuggestions, minPercent, pantryEmpty]);

  const { cookNow: cookNowDiscovery, needItems: needItemsDiscovery } = useMemo(
    () => splitDiscoveryCookNowLists(filteredDiscoverySuggestions, pantryFilter, minPercent, pantry.length),
    [filteredDiscoverySuggestions, minPercent, pantry.length, pantryFilter],
  );

  const hasCookNowMatches = cookNowRecipes.length > 0 || cookNowDiscovery.length > 0;
  const hasNeedItemsMatches = needItemsRecipes.length > 0 || needItemsDiscovery.length > 0;

  useEffect(() => {
    if (typeof params.recipeId === 'string' && params.recipeId) {
      setActiveId(params.recipeId);
    }
  }, [params.recipeId]);

  useEffect(() => {
    if (filteredKitchenRecipes.length === 0) {
      setActiveId('');
      return;
    }
    if (!filteredKitchenRecipes.some((r) => r.id === activeId)) {
      setActiveId(filteredKitchenRecipes[0].id);
    }
  }, [activeId, filteredKitchenRecipes]);

  const active = recipes.find((r) => r.id === activeId);
  const activeMatch = active ? pantryRecipeMatches.byRecipeId.get(active.id) : undefined;
  const servings = active ? servingOverrides[active.id] ?? active.servings : 4;
  const scale = active && active.servings > 0 ? servings / active.servings : 1;

  const showKitchenEmpty =
    pantryEmpty ||
    (!discoveryLoading &&
      filteredKitchenRecipes.length === 0 &&
      filteredDiscoverySuggestions.length === 0);

  return (
    <ScrollView className="flex-1 bg-paper px-4 pb-8">
      {activeMealCount > 0 ? (
        <Pressable
          onPress={() => router.push('/')}
          className="mt-4 flex-row items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
        >
          <Text className="text-sm font-semibold text-ink">{RECIPES_COPY.mealsOnHomeLink(activeMealCount)}</Text>
          <Ionicons name="chevron-forward" size={18} color={THEME.muted} />
        </Pressable>
      ) : null}

      <GuestSaveNudge />

      <Card
        className="mt-4"
        title={RECIPES_COPY.cookNowCard.title}
        subtitle={RECIPES_COPY.cookNowCard.subtitle}
      >
        <Text className="mt-1 text-xs font-semibold text-muted">{RECIPES_COPY.cookNowCard.sortFilterLabel}</Text>
        <FilterChips
          allowClear={false}
          options={FILTER_OPTIONS}
          selectedId={pantryFilter}
          onSelect={(id) => setPantryFilter((id as RecipePantryFilterMode) ?? 'best_match')}
        />
        <Text className="mt-3 text-xs font-semibold text-muted">{RECIPES_COPY.cookNowCard.pantryOverlapLabel}</Text>
        <View className="mt-1 flex-row flex-wrap gap-2">
          {MIN_PERCENT_CHIPS.map((pct) => {
            const activeChip = minPercent === pct;
            return (
              <Pressable
                key={pct}
                onPress={() => setMinPercent(pct)}
                className={`rounded-full px-3 py-1.5 ${activeChip ? 'bg-primary' : 'border border-border bg-paper'}`}
              >
                <Text className={`text-xs font-semibold ${activeChip ? 'text-on-primary' : 'text-muted'}`}>
                  {RECIPES_COPY.minPantryOverlapChips[pct]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {showKitchenEmpty ? <RecipesEmptyState pantryEmpty={pantryEmpty} /> : null}

      {!pantryEmpty && !showKitchenEmpty && filteredKitchenRecipes.length === 0 && filteredDiscoverySuggestions.length > 0 ? (
        <Text className="mt-3 text-sm text-muted">{RECIPES_COPY.kitchenFilteredEmptyWithDiscovery}</Text>
      ) : null}

      {hasCookNowMatches ? (
        <RecipeListSection
          title={RECIPES_COPY.readyToCook.title}
          subtitle={RECIPES_COPY.readyToCook.subtitle}
          list={cookNowRecipes}
          activeId={activeId}
          setActiveId={selectRecipe}
          pantryRecipeMatches={pantryRecipeMatches}
          isOnMealPlan={isOnMealPlan}
          toggleMealPlanKitchenRecipe={toggleMealPlanKitchenRecipe}
        />
      ) : null}

      <DiscoveryRecipeListSection
        title={cookNowRecipes.length > 0 ? RECIPES_COPY.readyToCook.discoveryTitle : RECIPES_COPY.readyToCook.title}
        subtitle={RECIPES_COPY.readyToCook.discoverySubtitle}
        list={cookNowDiscovery}
        isOnMealPlan={(recipeApiId) => isOnMealPlan({ recipeApiId })}
        toggleMealPlanDiscoveryRecipe={toggleMealPlanDiscoveryRecipe}
      />

      {hasNeedItemsMatches ? (
        <RecipeListSection
          title={RECIPES_COPY.needAFewItems.title}
          subtitle={RECIPES_COPY.needAFewItems.subtitle}
          list={needItemsRecipes}
          activeId={activeId}
          setActiveId={selectRecipe}
          pantryRecipeMatches={pantryRecipeMatches}
          isOnMealPlan={isOnMealPlan}
          toggleMealPlanKitchenRecipe={toggleMealPlanKitchenRecipe}
        />
      ) : null}

      <DiscoveryRecipeListSection
        title={
          needItemsRecipes.length > 0
            ? RECIPES_COPY.needAFewItems.discoveryTitle
            : RECIPES_COPY.needAFewItems.title
        }
        subtitle={RECIPES_COPY.needAFewItems.discoverySubtitle}
        list={needItemsDiscovery}
        isOnMealPlan={(recipeApiId) => isOnMealPlan({ recipeApiId })}
        toggleMealPlanDiscoveryRecipe={toggleMealPlanDiscoveryRecipe}
      />

      {!pantryEmpty ? (
        <Card
          className="mt-2"
          title={RECIPES_COPY.moreIdeasCard.title}
          subtitle={RECIPES_COPY.moreIdeasCard.subtitle}
        >
          {discoveryLoading ? (
            <View className="mt-3 flex-row items-center gap-2">
              <ActivityIndicator color={THEME.primary} />
              <Text className="text-sm text-muted">{RECIPES_COPY.moreIdeasCard.loading}</Text>
            </View>
          ) : null}
          {!discoveryLoading && discoveryError ? (
            <Text className="mt-3 text-sm text-muted">{discoveryError}</Text>
          ) : null}
          {!discoveryLoading && !discoveryError && filteredDiscoverySuggestions.length === 0 ? (
            <Text className="mt-3 text-sm text-muted">{RECIPES_COPY.moreIdeasCard.empty}</Text>
          ) : null}
          {filteredDiscoverySuggestions.map(({ recipe, match }) => {
            const onPlan = isOnMealPlan({ recipeApiId: recipe.id });
            return (
              <Pressable
                key={`api-${recipe.id}`}
                onPress={() => router.push(`/discover-recipes/${recipe.id}`)}
                className="mt-3"
              >
                <Card>
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-2">
                      <Text className="text-base font-bold text-ink">{recipe.name}</Text>
                      <RecipePantryMatchBadge match={match} />
                    </View>
                    <Pressable
                      onPress={() => void toggleMealPlanDiscoveryRecipe(recipe)}
                      className={`rounded-full px-3 py-1 ${onPlan ? 'bg-primary' : 'border border-border bg-paper'}`}
                    >
                      <Text className={`text-xs font-bold ${onPlan ? 'text-on-primary' : 'text-muted'}`}>
                        {onPlan ? RECIPES_COPY.mealPlanChip.onPlan : RECIPES_COPY.mealPlanChip.add}
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      {active && activeMatch ? (
        <Card title={RECIPES_COPY.pantryCheck.title} subtitle={active.name} className="mt-3">
          <Text className="mt-2 text-sm font-semibold text-primary-dark">{RECIPES_COPY.pantryCheck.youHave}</Text>
          {activeMatch.matched.length === 0 ? (
            <Text className="mt-1 text-sm text-muted">{RECIPES_COPY.pantryCheck.noPantryItemsYet}</Text>
          ) : (
            activeMatch.matched.map((row) => (
              <Text key={row.ingredient.ingredientId} className="mt-1 text-sm text-muted">
                ✓ {row.ingredient.name}
                {row.matchedPantryItem ? ` · ${row.matchedPantryItem.name}` : ''}
              </Text>
            ))
          )}
          <Text className="mt-4 text-sm font-semibold text-danger">{RECIPES_COPY.pantryCheck.stillNeed}</Text>
          {activeMatch.missing.length === 0 ? (
            <Text className="mt-1 text-sm text-muted">{RECIPES_COPY.pantryCheck.readyToCook}</Text>
          ) : (
            activeMatch.missing.map((ing) => (
              <Text key={ing.ingredientId} className="mt-1 text-sm text-muted">
                · {ing.name}
              </Text>
            ))
          )}
          {activeMatch.missing.length > 0 ? (
            <Pressable
              onPress={() => addMissingRecipeIngredientsToGrocery(active.id)}
              className="mt-4 items-center rounded-xl bg-primary py-3"
            >
              <Text className="text-sm font-bold text-on-primary">{RECIPES_COPY.pantryCheck.addMissingCta}</Text>
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      {active && featureFlags.batchCalculator ? (
        <Card
          title={RECIPES_COPY.batchCalculator.title}
          subtitle={RECIPES_COPY.batchCalculator.scalingSubtitle(active.name)}
        >
          <Text className="mt-2 text-sm text-muted">
            {RECIPES_COPY.batchCalculator.targetServings(active.servings)}
          </Text>
          <View className="mt-2 flex-row items-center gap-3">
            <Pressable
              onPress={() => setServingOverride(active.id, Math.max(1, servings - 1))}
              className="rounded-lg border border-border px-4 py-2"
            >
              <Text className="font-bold text-ink">−</Text>
            </Pressable>
            <TextInput
              keyboardType="number-pad"
              value={String(servings)}
              onChangeText={(text) => {
                const n = Number.parseInt(text, 10);
                if (!Number.isNaN(n)) setServingOverride(active.id, Math.max(1, n));
              }}
              className="min-w-[64px] rounded-lg border border-border bg-card px-3 py-2 text-center text-lg font-bold text-ink"
            />
            <Pressable
              onPress={() => setServingOverride(active.id, servings + 1)}
              className="rounded-lg border border-border px-4 py-2"
            >
              <Text className="font-bold text-ink">+</Text>
            </Pressable>
          </View>
          <Text className="mt-4 text-sm font-semibold text-ink">{RECIPES_COPY.batchCalculator.scaledIngredients}</Text>
          {active.ingredients.map((ing) => (
            <Text key={ing.ingredientId} className="mt-1 text-sm text-muted">
              {ing.name}: {(ing.quantity * scale).toFixed(1)} {ing.unit}
            </Text>
          ))}
        </Card>
      ) : null}

      <DiscoverRecipesPanel
        onToggleMealPlan={(item) => void toggleMealPlanDiscoveryRecipe(item)}
        isOnMealPlan={(apiId) => isOnMealPlan({ recipeApiId: apiId })}
      />
    </ScrollView>
  );
}
