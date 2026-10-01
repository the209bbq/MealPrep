import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Card } from '../../components/Card';
import { DiscoverRecipesPanel } from '../../components/DiscoverRecipesPanel';
import { FilterChips } from '../../components/FilterChips';
import { RecipePantryMatchBadge } from '../../components/RecipePantryMatch';
import { RecipesEmptyState } from '../../components/RecipesEmptyState';
import { RECIPES_TAB, THEME } from '../../config/appConfig';
import { useApp } from '../../context/AppContext';
import {
  filterRankedMatches,
  type PantryMatchIndex,
  type RecipePantryFilterMode,
} from '../../lib/recipeMatch';
import type { Recipe } from '../../types/mealprep';

const FILTER_OPTIONS: { id: RecipePantryFilterMode; label: string }[] = [
  { id: 'best_match', label: 'Best match first' },
  { id: 'have_all', label: 'Have everything' },
  { id: 'missing_1_2', label: '1–2 missing' },
  { id: 'all', label: 'Show all' },
];

const MIN_PERCENT_CHIPS = [0, 50, 70, 90] as const;

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
            <Card className={`mb-3 ${activeId === recipe.id ? 'border-emerald' : ''}`}>
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-2">
                  <Text className="text-xs font-semibold uppercase text-emerald">{recipe.tag}</Text>
                  <Text className="text-base font-bold text-ink">{recipe.name}</Text>
                  <Text className="mt-1 text-sm text-muted">{recipe.description}</Text>
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
    </>
  );
}

export default function RecipesScreen() {
  const params = useLocalSearchParams<{ recipeId?: string }>();
  const {
    recipes,
    pantry,
    servingOverrides,
    setServingOverride,
    featureFlags,
    pantryRecipeMatches,
    addMissingRecipeIngredientsToGrocery,
    mealPlan,
    toggleMealPlanDiscoveryRecipe,
    isOnMealPlan,
    toggleMealPlanKitchenRecipe,
  } = useApp();
  const [activeId, setActiveId] = useState('');
  const [pantryFilter, setPantryFilter] = useState<RecipePantryFilterMode>('best_match');
  const [minPercent, setMinPercent] = useState<number>(RECIPES_TAB.defaultMinPercent);

  const pantryEmpty = pantry.length === 0;
  const activeMealCount = mealPlan.filter((m) => !m.made).length;

  const filteredKitchenRecipes = useMemo(() => {
    if (pantryEmpty) return [];
    const mode = pantryFilter === 'best_match' ? 'all' : pantryFilter;
    const hideZero = RECIPES_TAB.hideZeroPantryMatches && pantryFilter !== 'all';
    const minMatched =
      pantryFilter === 'all' ? 0 : RECIPES_TAB.defaultMinMatchedCount;
    const ranked = filterRankedMatches(pantryRecipeMatches.ranked, mode, minPercent, {
      minMatchedCount: hideZero ? Math.max(minMatched, 1) : minMatched,
    });
    const rankedIds = ranked.map((m) => m.recipeId);
    const idSet = new Set(rankedIds);
    const list = recipes.filter((r) => idSet.has(r.id));
    list.sort((a, b) => rankedIds.indexOf(a.id) - rankedIds.indexOf(b.id));
    return list;
  }, [minPercent, pantryEmpty, pantryFilter, pantryRecipeMatches.ranked, recipes]);

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

  return (
    <ScrollView className="flex-1 bg-paper px-4 pb-8">
      {activeMealCount > 0 ? (
        <Pressable onPress={() => router.push('/')} className="mt-4 flex-row items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
          <Text className="text-sm font-semibold text-ink">Meals to make on Home ({activeMealCount})</Text>
          <Ionicons name="chevron-forward" size={18} color={THEME.muted} />
        </Pressable>
      ) : null}

      <Card className="mt-4" title="Cook now" subtitle="Kitchen recipes ranked by what is already in your pantry">
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

      {filteredKitchenRecipes.length === 0 ? <RecipesEmptyState pantryEmpty={pantryEmpty} /> : null}

      <RecipeListSection
        title="Ready to cook"
        subtitle="Everything on hand — save a grocery run"
        list={cookNowRecipes}
        activeId={activeId}
        setActiveId={setActiveId}
        pantryRecipeMatches={pantryRecipeMatches}
        isOnMealPlan={isOnMealPlan}
        toggleMealPlanKitchenRecipe={toggleMealPlanKitchenRecipe}
      />

      <RecipeListSection
        title="Need a few items"
        subtitle="Add missing ingredients to your list, then Smart Shop"
        list={needItemsRecipes}
        activeId={activeId}
        setActiveId={setActiveId}
        pantryRecipeMatches={pantryRecipeMatches}
        isOnMealPlan={isOnMealPlan}
        toggleMealPlanKitchenRecipe={toggleMealPlanKitchenRecipe}
      />

      {active && activeMatch ? (
        <Card title="Pantry check" subtitle={active.name} className="mt-3">
          <Text className="mt-2 text-sm font-semibold text-emerald-dark">You have</Text>
          {activeMatch.matched.length === 0 ? (
            <Text className="mt-1 text-sm text-muted">No matching pantry items yet.</Text>
          ) : (
            activeMatch.matched.map((row) => (
              <Text key={row.ingredient.ingredientId} className="mt-1 text-sm text-muted">
                ✓ {row.ingredient.name}
                {row.matchReason === 'staple' ? ' (staple)' : row.matchedPantryItem ? ` · ${row.matchedPantryItem.name}` : ''}
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

      <DiscoverRecipesPanel
        onToggleMealPlan={(item) => void toggleMealPlanDiscoveryRecipe(item)}
        isOnMealPlan={(apiId) => isOnMealPlan({ recipeApiId: apiId })}
      />
    </ScrollView>
  );
}
