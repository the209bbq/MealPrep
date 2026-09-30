import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Card } from '../../components/Card';
import { DiscoverRecipesPanel } from '../../components/DiscoverRecipesPanel';
import { FilterChips } from '../../components/FilterChips';
import { MealsToMakePanel } from '../../components/MealsToMakePanel';
import { RecipesPantryEmptyState } from '../../components/RecipesPantryEmptyState';
import { RecipePantryMatchBadge } from '../../components/RecipePantryMatch';
import { DEFAULT_MIN_PANTRY_MATCH_PERCENT } from '../../config/recipeMatching';
import { THEME } from '../../config/appConfig';
import { useApp } from '../../context/AppContext';
import { fetchPantryDiscoverySuggestions, type PantryDiscoverySuggestion } from '../../lib/recipeDiscovery/pantrySuggestions';
import {
  filterRankedMatches,
  type RecipePantryFilterMode,
} from '../../lib/recipeMatch';
import { nutritionLabel } from '../../lib/nutrition';

const FILTER_OPTIONS: { id: RecipePantryFilterMode; label: string }[] = [
  { id: 'best_match', label: 'Best match first' },
  { id: 'have_all', label: 'Have everything' },
  { id: 'missing_1_2', label: '1–2 missing' },
  { id: 'all', label: 'Show all' },
];

const MIN_PERCENT_CHIPS = [0, 50, 70, 90] as const;

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
    toggleMealPlanKitchenRecipe,
    toggleMealPlanDiscoveryRecipe,
    removeMealPlanItem,
    setMealPlanItemMade,
    isOnMealPlan,
    addMissingForPlannedMealsToGrocery,
  } = useApp();
  const [activeId, setActiveId] = useState(recipes[0]?.id ?? '');
  const [showMyRecipes, setShowMyRecipes] = useState(false);
  const [pantryFilter, setPantryFilter] = useState<RecipePantryFilterMode>('best_match');
  const [minPercent, setMinPercent] = useState(DEFAULT_MIN_PANTRY_MATCH_PERCENT);
  const [discoverySuggestions, setDiscoverySuggestions] = useState<PantryDiscoverySuggestion[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);

  const pantryEmpty = pantry.length === 0;
  const accessToken = session?.access_token ?? null;

  useEffect(() => {
    if (typeof params.recipeId === 'string' && params.recipeId) {
      setActiveId(params.recipeId);
      setShowMyRecipes(true);
    }
  }, [params.recipeId]);

  useEffect(() => {
    if (!recipes.some((r) => r.id === activeId) && recipes[0]) {
      setActiveId(recipes[0].id);
    }
  }, [activeId, recipes]);

  useEffect(() => {
    if (pantryEmpty) {
      setDiscoverySuggestions([]);
      return;
    }
    let cancelled = false;
    setDiscoveryLoading(true);
    void fetchPantryDiscoverySuggestions(pantry, accessToken)
      .then((rows) => {
        if (!cancelled) setDiscoverySuggestions(rows);
      })
      .catch(() => {
        if (!cancelled) setDiscoverySuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setDiscoveryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, pantry, pantryEmpty]);

  const filteredKitchenRecipes = useMemo(() => {
    if (pantryEmpty) return [];
    const mode = pantryFilter === 'best_match' ? 'all' : pantryFilter;
    const rankedIds = filterRankedMatches(pantryRecipeMatches.ranked, mode, {
      minPercent,
      pantryItemCount: pantry.length,
    }).map((m) => m.recipeId);
    const idSet = new Set(rankedIds);
    const list = recipes.filter((r) => idSet.has(r.id));
    if (pantryFilter === 'best_match') {
      list.sort((a, b) => rankedIds.indexOf(a.id) - rankedIds.indexOf(b.id));
    }
    return list;
  }, [minPercent, pantry.length, pantryEmpty, pantryFilter, pantryRecipeMatches.ranked, recipes]);

  const filteredDiscoverySuggestions = useMemo(() => {
    if (pantryEmpty) return [];
    return discoverySuggestions.filter(
      (row) => row.match.percentMatch >= minPercent && row.match.matchedCount >= 2,
    );
  }, [discoverySuggestions, minPercent, pantryEmpty]);

  const hasAnyPantryMatches =
    filteredKitchenRecipes.length > 0 || filteredDiscoverySuggestions.length > 0;

  const active = recipes.find((r) => r.id === activeId) ?? recipes[0];
  const activeMatch = active ? pantryRecipeMatches.byRecipeId.get(active.id) : undefined;
  const servings = active ? servingOverrides[active.id] ?? active.servings : 4;
  const scale = active && active.servings > 0 ? servings / active.servings : 1;

  return (
    <ScrollView className="flex-1 bg-paper px-4 pb-8">
      <DiscoverRecipesPanel
        onToggleMealPlan={(item) => void toggleMealPlanDiscoveryRecipe(item)}
        isOnMealPlan={(apiId) => isOnMealPlan({ recipeApiId: apiId })}
      />

      <MealsToMakePanel
        compact
        items={mealPlan}
        onRemove={(id) => void removeMealPlanItem(id)}
        onToggleMade={(id, made) => void setMealPlanItemMade(id, made)}
        onAddMissingToGrocery={addMissingForPlannedMealsToGrocery}
      />

      <View className="mt-4 flex-row gap-2">
        <Pressable
          onPress={() => setShowMyRecipes(false)}
          className={`flex-1 rounded-full px-3 py-2 ${!showMyRecipes ? 'bg-emerald' : 'border border-border bg-card'}`}
        >
          <Text className={`text-center text-xs font-bold ${!showMyRecipes ? 'text-on-emerald' : 'text-muted'}`}>
            From pantry
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setShowMyRecipes(true)}
          className={`flex-1 rounded-full px-3 py-2 ${showMyRecipes ? 'bg-emerald' : 'border border-border bg-card'}`}
        >
          <Text className={`text-center text-xs font-bold ${showMyRecipes ? 'text-on-emerald' : 'text-muted'}`}>
            My recipes
          </Text>
        </Pressable>
      </View>

      {showMyRecipes ? (
        <>
          {pantryEmpty ? (
            <RecipesPantryEmptyState />
          ) : (
            <>
              <Card className="mt-3" title="What can I make?" subtitle="Kitchen recipes matched to your pantry">
                <Text className="mt-1 text-xs font-semibold text-muted">Sort & filter</Text>
                <FilterChips
                  allowClear={false}
                  options={FILTER_OPTIONS}
                  selectedId={pantryFilter}
                  onSelect={(id) => setPantryFilter((id as RecipePantryFilterMode) ?? 'best_match')}
                />
                <Text className="mt-3 text-xs font-semibold text-muted">Minimum match</Text>
                <View className="mt-1 flex-row flex-wrap gap-2">
                  {MIN_PERCENT_CHIPS.map((pct) => {
                    const activeChip = minPercent === pct;
                    return (
                      <Pressable
                        key={pct}
                        onPress={() => setMinPercent(pct)}
                        className={`rounded-full px-3 py-1.5 ${activeChip ? 'bg-emerald' : 'border border-border bg-paper'}`}
                      >
                        <Text className={`text-xs font-semibold ${activeChip ? 'text-on-emerald' : 'text-muted'}`}>
                          {pct === 0 ? 'Any %' : `${pct}%+`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Card>

              {!hasAnyPantryMatches ? (
                <Text className="mt-4 text-sm text-muted">
                  No recipes meet a {minPercent}% match with at least 2 pantry ingredients. Scan more items or lower the
                  minimum match.
                </Text>
              ) : null}

              {filteredKitchenRecipes.map((recipe) => {
                const onPlan = isOnMealPlan({ recipeSlug: recipe.id });
                const match = pantryRecipeMatches.byRecipeId.get(recipe.id);
                return (
                  <Pressable key={recipe.id} onPress={() => setActiveId(recipe.id)}>
                    <Card className={`mb-3 ${active?.id === recipe.id ? 'border-emerald' : ''}`}>
                      <View className="flex-row items-start justify-between">
                        <View className="flex-1 pr-2">
                          <Text className="text-xs font-semibold uppercase text-emerald">{recipe.tag}</Text>
                          <Text className="text-base font-bold text-ink">{recipe.name}</Text>
                          <Text className="mt-1 text-sm text-muted">{recipe.description}</Text>
                          <RecipePantryMatchBadge match={match} />
                          <Text className="mt-2 text-xs text-muted">
                            {recipe.servings} servings · {recipe.minutes} min · {nutritionLabel(recipe)}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => void toggleMealPlanKitchenRecipe(recipe.id)}
                          className={`rounded-full px-3 py-1 ${onPlan ? 'bg-emerald' : 'border border-border bg-paper'}`}
                        >
                          <Text className={`text-xs font-bold ${onPlan ? 'text-on-emerald' : 'text-muted'}`}>
                            {onPlan ? 'In meals' : 'Add to meals'}
                          </Text>
                        </Pressable>
                      </View>
                    </Card>
                  </Pressable>
                );
              })}

              {active && activeMatch ? (
                <Card title="Pantry check" subtitle={active.name}>
                  <Text className="mt-2 text-sm font-semibold text-emerald-dark">You have</Text>
                  {activeMatch.matched.length === 0 ? (
                    <Text className="mt-1 text-sm text-muted">No matching pantry items yet.</Text>
                  ) : (
                    activeMatch.matched.map((row) => (
                      <Text key={row.ingredient.ingredientId} className="mt-1 text-sm text-muted">
                        ✓ {row.ingredient.name}
                        {row.matchedPantryItem ? ` · ${row.matchedPantryItem.name}` : ''}
                      </Text>
                    ))
                  )}
                  <Text className="mt-4 text-sm font-semibold text-danger">Still need</Text>
                  {activeMatch.missing.length === 0 ? (
                    <Text className="mt-1 text-sm text-muted">Nothing — you are ready to cook.</Text>
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
                      className="mt-4 items-center rounded-xl bg-emerald py-3"
                    >
                      <Text className="text-sm font-bold text-on-emerald">Add missing to grocery list</Text>
                    </Pressable>
                  ) : null}
                </Card>
              ) : null}

              {active && featureFlags.batchCalculator ? (
                <Card title="Batch meal prep calculator" subtitle={`Scaling ${active.name}`}>
                  <Text className="mt-2 text-sm text-muted">Target servings (base: {active.servings})</Text>
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
                  <Text className="mt-4 text-sm font-semibold text-ink">Scaled ingredients</Text>
                  {active.ingredients.map((ing) => (
                    <Text key={ing.ingredientId} className="mt-1 text-sm text-muted">
                      {ing.name}: {(ing.quantity * scale).toFixed(1)} {ing.unit}
                    </Text>
                  ))}
                </Card>
              ) : null}
            </>
          )}
        </>
      ) : (
        <>
          {pantryEmpty ? (
            <RecipesPantryEmptyState />
          ) : (
            <>
              <Card className="mt-3" title="Suggested from your pantry" subtitle="Kitchen catalog + RecipeAPI, ranked by match">
                <Text className="mt-3 text-xs font-semibold text-muted">Minimum match</Text>
                <View className="mt-1 flex-row flex-wrap gap-2">
                  {MIN_PERCENT_CHIPS.map((pct) => {
                    const activeChip = minPercent === pct;
                    return (
                      <Pressable
                        key={pct}
                        onPress={() => setMinPercent(pct)}
                        className={`rounded-full px-3 py-1.5 ${activeChip ? 'bg-emerald' : 'border border-border bg-paper'}`}
                      >
                        <Text className={`text-xs font-semibold ${activeChip ? 'text-on-emerald' : 'text-muted'}`}>
                          {pct === 0 ? 'Any %' : `${pct}%+`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {discoveryLoading ? (
                  <View className="mt-4 flex-row items-center gap-2">
                    <ActivityIndicator color={THEME.emerald} />
                    <Text className="text-sm text-muted">Finding recipes for your ingredients…</Text>
                  </View>
                ) : null}
              </Card>

              {!hasAnyPantryMatches && !discoveryLoading ? (
                <Text className="mt-4 text-sm text-muted">
                  No recipes meet a {minPercent}% match with at least 2 pantry ingredients. Scan more items or lower the
                  minimum match.
                </Text>
              ) : null}

              {filteredKitchenRecipes.map((recipe) => {
                const onPlan = isOnMealPlan({ recipeSlug: recipe.id });
                const match = pantryRecipeMatches.byRecipeId.get(recipe.id);
                return (
                  <Pressable key={recipe.id} onPress={() => setActiveId(recipe.id)}>
                    <Card className="mb-3">
                      <View className="flex-row items-start justify-between">
                        <View className="flex-1 pr-2">
                          <Text className="text-[10px] font-bold uppercase text-muted">Kitchen</Text>
                          <Text className="text-base font-bold text-ink">{recipe.name}</Text>
                          <RecipePantryMatchBadge match={match} />
                        </View>
                        <Pressable
                          onPress={() => void toggleMealPlanKitchenRecipe(recipe.id)}
                          className={`rounded-full px-3 py-1 ${onPlan ? 'bg-emerald' : 'border border-border bg-paper'}`}
                        >
                          <Text className={`text-xs font-bold ${onPlan ? 'text-on-emerald' : 'text-muted'}`}>
                            {onPlan ? 'In meals' : 'Add to meals'}
                          </Text>
                        </Pressable>
                      </View>
                    </Card>
                  </Pressable>
                );
              })}

              {filteredDiscoverySuggestions.map(({ recipe, match }) => {
                const onPlan = isOnMealPlan({ recipeApiId: recipe.id });
                return (
                  <Pressable
                    key={`api-${recipe.id}`}
                    onPress={() => router.push(`/discover-recipes/${recipe.id}`)}
                  >
                    <Card className="mb-3">
                      <View className="flex-row items-start justify-between">
                        <View className="flex-1 pr-2">
                          <Text className="text-[10px] font-bold uppercase text-muted">Discover</Text>
                          <Text className="text-base font-bold text-ink">{recipe.name}</Text>
                          <RecipePantryMatchBadge match={match} />
                        </View>
                        <Pressable
                          onPress={() => void toggleMealPlanDiscoveryRecipe(recipe)}
                          className={`rounded-full px-3 py-1 ${onPlan ? 'bg-emerald' : 'border border-border bg-paper'}`}
                        >
                          <Text className={`text-xs font-bold ${onPlan ? 'text-on-emerald' : 'text-muted'}`}>
                            {onPlan ? 'In meals' : 'Add to meals'}
                          </Text>
                        </Pressable>
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}
