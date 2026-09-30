import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { RECIPE_DISCOVERY } from '../../config/appConfig';
import { Card } from '../../components/Card';
import { FilterChips } from '../../components/FilterChips';
import { RecipePantryMatchBadge } from '../../components/RecipePantryMatch';
import { useApp } from '../../context/AppContext';
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
    selectedRecipeIds,
    servingOverrides,
    toggleRecipeSelection,
    setServingOverride,
    featureFlags,
    pantryRecipeMatches,
    addMissingRecipeIngredientsToGrocery,
  } = useApp();
  const [activeId, setActiveId] = useState(recipes[0]?.id ?? '');
  const [pantryFilter, setPantryFilter] = useState<RecipePantryFilterMode>('best_match');
  const [minPercent, setMinPercent] = useState(0);

  useEffect(() => {
    if (typeof params.recipeId === 'string' && params.recipeId) {
      setActiveId(params.recipeId);
    }
  }, [params.recipeId]);

  useEffect(() => {
    if (!recipes.some((r) => r.id === activeId) && recipes[0]) {
      setActiveId(recipes[0].id);
    }
  }, [activeId, recipes]);

  const filteredRecipes = useMemo(() => {
    const mode = pantryFilter === 'best_match' ? 'all' : pantryFilter;
    const rankedIds = filterRankedMatches(pantryRecipeMatches.ranked, mode, minPercent).map(
      (m) => m.recipeId,
    );
    const idSet = new Set(rankedIds);
    const list = recipes.filter((r) => idSet.has(r.id));
    if (pantryFilter === 'best_match') {
      list.sort((a, b) => rankedIds.indexOf(a.id) - rankedIds.indexOf(b.id));
    }
    return list;
  }, [minPercent, pantryFilter, pantryRecipeMatches.ranked, recipes]);

  const active = recipes.find((r) => r.id === activeId) ?? recipes[0];
  const activeMatch = active ? pantryRecipeMatches.byRecipeId.get(active.id) : undefined;
  const servings = active ? servingOverrides[active.id] ?? active.servings : 4;
  const scale = active && active.servings > 0 ? servings / active.servings : 1;

  return (
    <ScrollView className="flex-1 bg-paper px-4 pb-8">
      <View className="mt-4 flex-row items-center justify-between">
        <Text className="text-lg font-bold text-ink">Recipe library</Text>
        {RECIPE_DISCOVERY.enabled ? (
          <Pressable
            onPress={() => router.push('/discover-recipes')}
            className="rounded-full border border-emerald bg-emerald-light px-3 py-1.5"
          >
            <Text className="text-xs font-bold text-emerald-dark">Discover recipes</Text>
          </Pressable>
        ) : null}
      </View>

      <Card className="mt-3" title="What can I make?" subtitle="Match recipes to your pantry">
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

      {filteredRecipes.length === 0 ? (
        <Text className="mt-4 text-sm text-muted">No recipes match this pantry filter. Try lowering the minimum %.</Text>
      ) : null}

      {filteredRecipes.map((recipe) => {
        const selected = selectedRecipeIds.includes(recipe.id);
        const match = pantryRecipeMatches.byRecipeId.get(recipe.id);
        return (
          <Pressable key={recipe.id} onPress={() => setActiveId(recipe.id)}>
            <Card className={`mb-3 ${active?.id === recipe.id ? 'border-emerald' : ''}`}>
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="text-xs font-semibold uppercase text-emerald">{recipe.tag}</Text>
                  <Text className="text-base font-bold text-ink">{recipe.name}</Text>
                  <Text className="mt-1 text-sm text-muted">{recipe.description}</Text>
                  <RecipePantryMatchBadge match={match} />
                  <Text className="mt-2 text-xs text-muted">
                    {recipe.servings} servings · {recipe.minutes} min · {nutritionLabel(recipe)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => toggleRecipeSelection(recipe.id)}
                  className={`rounded-full px-3 py-1 ${selected ? 'bg-emerald' : 'border border-border bg-paper'}`}
                >
                  <Text className={`text-xs font-bold ${selected ? 'text-on-emerald' : 'text-muted'}`}>
                    {selected ? 'In plan' : 'Add'}
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
    </ScrollView>
  );
}
