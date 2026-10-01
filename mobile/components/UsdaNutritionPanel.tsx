import { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { Recipe, RecipeIngredient, UsdaFoodMatch } from '../types/mealprep';
import {
  applyIngredientUsda,
  applyRecipeTotalsFromIngredients,
  getStoredUsdaApiKey,
  getUsdaFoodScaled,
  nutritionLabel,
  searchUsdaFoods,
  setStoredUsdaApiKey,
} from '../lib/nutrition';
import { USDA_DEMO_API_KEY } from '../config/appConfig';

interface UsdaNutritionPanelProps {
  recipes: Recipe[];
  onSave: (recipe: Recipe) => void;
}

export function UsdaNutritionPanel({ recipes, onSave }: UsdaNutritionPanelProps) {
  const [selectedRecipeId, setSelectedRecipeId] = useState(recipes[0]?.id ?? '');
  const recipe = recipes.find((r) => r.id === selectedRecipeId) ?? recipes[0];
  const [apiKey, setApiKey] = useState(() => getStoredUsdaApiKey());
  const [query, setQuery] = useState('');
  const [grams, setGrams] = useState('100');
  const [targetIngredientId, setTargetIngredientId] = useState(recipe?.ingredients[0]?.ingredientId ?? '');
  const [matches, setMatches] = useState<UsdaFoodMatch[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const saveApiKey = useCallback(() => {
    setStoredUsdaApiKey(apiKey);
    setStatus('USDA key saved on this device only.');
  }, [apiKey]);

  const runSearch = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    setMatches([]);
    try {
      const results = await searchUsdaFoods(query, 8, apiKey);
      setMatches(results);
      if (results.length === 0) setStatus('No USDA matches — try another search.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'USDA search failed');
    } finally {
      setBusy(false);
    }
  }, [apiKey, query]);

  const attachMatch = useCallback(
    async (match: UsdaFoodMatch) => {
      if (!recipe) return;
      setBusy(true);
      setStatus(null);
      try {
        const g = Number.parseFloat(grams) || 100;
        const detail = await getUsdaFoodScaled(match.fdcId, g, apiKey);
        const ingredient = recipe.ingredients.find((item) => item.ingredientId === targetIngredientId);
        if (!ingredient) {
          setStatus('Pick an ingredient line first.');
          return;
        }
        const nextIngredients = recipe.ingredients.map((item) =>
          item.ingredientId === targetIngredientId
            ? applyIngredientUsda({ ...item, grams: g }, match.fdcId, detail.scaled, {
                source: detail.source,
                citation: detail.citation,
              })
            : item,
        );
        const nextRecipe = applyRecipeTotalsFromIngredients({ ...recipe, ingredients: nextIngredients });
        onSave(nextRecipe);
        setStatus(`Attached USDA data to ${ingredient.name}. Recipe totals updated per serving.`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Failed to attach USDA food');
      } finally {
        setBusy(false);
      }
    },
    [apiKey, grams, onSave, recipe, targetIngredientId],
  );

  const applySearchToRecipe = useCallback(
    async (match: UsdaFoodMatch) => {
      if (!recipe) return;
      setBusy(true);
      setStatus(null);
      try {
        const g = Number.parseFloat(grams) || 100;
        const detail = await getUsdaFoodScaled(match.fdcId, g, apiKey);
        const portions = recipe.servings > 0 ? recipe.servings : 1;
        const perServing = {
          calories: Math.round(detail.scaled.calories / portions),
          protein: Math.round(detail.scaled.protein / portions),
          carbs: Math.round(detail.scaled.carbs / portions),
          fat: Math.round(detail.scaled.fat / portions),
        };
        onSave({
          ...recipe,
          ...perServing,
          nutritionSource: detail.source,
          nutritionCitation: detail.citation,
          nutritionSourcedAt: new Date().toISOString(),
        });
        setStatus(`Saved per-serving nutrition from ${match.name}.`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Failed to save recipe nutrition');
      } finally {
        setBusy(false);
      }
    },
    [apiKey, grams, onSave, recipe],
  );

  if (!recipe) {
    return <Text className="text-sm text-muted">No recipes available for USDA lookup.</Text>;
  }

  return (
    <View>
      <Text className="text-sm font-semibold text-ink">USDA nutrition lookup</Text>
      <Text className="mt-1 text-xs text-muted">
        Uses EXPO_PUBLIC_USDA_FDC_API_KEY, a key saved here, or the public {USDA_DEMO_API_KEY} fallback (same as the
        kitchen board).
      </Text>
      {recipes.length > 1 ? (
        <>
          <Text className="mt-4 text-xs font-semibold text-muted">Recipe</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {recipes.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => {
                  setSelectedRecipeId(r.id);
                  setTargetIngredientId(r.ingredients[0]?.ingredientId ?? '');
                  setMatches([]);
                  setStatus(null);
                }}
                className={`rounded-full px-3 py-1 ${
                  selectedRecipeId === r.id ? 'bg-emerald' : 'border border-border bg-paper'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    selectedRecipeId === r.id ? 'text-on-emerald' : 'text-muted'
                  }`}
                >
                  {r.name.split(' ')[0]}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      <TextInput
        value={apiKey}
        onChangeText={setApiKey}
        secureTextEntry
        autoCapitalize="none"
        className="mt-3 rounded-xl border border-border bg-card px-3 py-2 text-ink"
        placeholder="Optional USDA API key (device storage)"
      />
      <Pressable onPress={saveApiKey} className="mt-2 self-start rounded-full border border-border px-3 py-1">
        <Text className="text-xs font-bold text-muted">Save key on device</Text>
      </Pressable>

      <Text className="mt-4 text-xs font-semibold text-muted">Attach to ingredient</Text>
      <View className="mt-2 flex-row flex-wrap gap-2">
        {recipe.ingredients.map((ing: RecipeIngredient) => (
          <Pressable
            key={ing.ingredientId}
            onPress={() => setTargetIngredientId(ing.ingredientId)}
            className={`rounded-full px-3 py-1 ${
              targetIngredientId === ing.ingredientId ? 'bg-emerald' : 'border border-border bg-paper'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                targetIngredientId === ing.ingredientId ? 'text-on-emerald' : 'text-muted'
              }`}
            >
              {ing.name.split(' ')[0]}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        className="mt-3 rounded-xl border border-border bg-card px-3 py-2 text-ink"
        placeholder="Search FoodData Central"
      />
      <TextInput
        value={grams}
        onChangeText={setGrams}
        keyboardType="decimal-pad"
        className="mt-2 rounded-xl border border-border bg-card px-3 py-2 text-ink"
        placeholder="Grams for this food (default 100)"
      />
      <Pressable
        disabled={busy || !query.trim()}
        onPress={() => void runSearch()}
        className={`mt-3 rounded-xl px-4 py-3 ${busy ? 'bg-emerald opacity-60' : 'bg-emerald'}`}
      >
        <Text className="text-center font-bold text-on-emerald">Search USDA</Text>
      </Pressable>

      <Text className="mt-3 text-xs text-muted">Current per serving: {nutritionLabel(recipe)}</Text>

      {matches.map((match) => (
        <View key={match.fdcId} className="mt-3 rounded-xl border border-border bg-card p-3">
          <Text className="text-sm font-semibold text-ink">{match.name}</Text>
          <Text className="text-xs text-muted">
            {match.nutritionPer100g.calories} kcal / 100g · {match.dataType}
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            <Pressable
              disabled={busy}
              onPress={() => void attachMatch(match)}
              className="rounded-full bg-emerald px-3 py-1"
            >
              <Text className="text-xs font-bold text-on-emerald">Attach to ingredient</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => void applySearchToRecipe(match)}
              className="rounded-full border border-border px-3 py-1"
            >
              <Text className="text-xs font-bold text-muted">Set recipe totals</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {status ? <Text className="mt-3 text-sm text-emerald-dark">{status}</Text> : null}
    </View>
  );
}
