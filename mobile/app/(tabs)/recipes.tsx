import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Card } from '../../components/Card';
import { useApp } from '../../context/AppContext';

export default function RecipesScreen() {
  const {
    recipes,
    selectedRecipeIds,
    servingOverrides,
    toggleRecipeSelection,
    setServingOverride,
    featureFlags,
  } = useApp();
  const [activeId, setActiveId] = useState(recipes[0]?.id ?? '');

  const active = recipes.find((r) => r.id === activeId) ?? recipes[0];
  const servings = active ? servingOverrides[active.id] ?? active.servings : 4;
  const scale = active && active.servings > 0 ? servings / active.servings : 1;

  return (
    <ScrollView className="flex-1 bg-paper px-4 pb-8">
      <Text className="mt-4 text-lg font-bold text-ink">Recipe library</Text>
      {recipes.map((recipe) => {
        const selected = selectedRecipeIds.includes(recipe.id);
        return (
          <Pressable key={recipe.id} onPress={() => setActiveId(recipe.id)}>
            <Card className={`mb-3 ${active?.id === recipe.id ? 'border-emerald' : ''}`}>
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="text-xs font-semibold uppercase text-emerald">{recipe.tag}</Text>
                  <Text className="text-base font-bold text-ink">{recipe.name}</Text>
                  <Text className="mt-1 text-sm text-muted">{recipe.description}</Text>
                  <Text className="mt-2 text-xs text-muted">
                    {recipe.servings} servings · {recipe.minutes} min · {recipe.protein}g protein
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
