import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../Card';
import { AddToCalendarButton } from '../mealCalendar/AddToCalendarButton';
import { RecipePantryMatchBadge } from '../RecipePantryMatch';
import { THEME } from '../../config/appConfig';
import { RECIPES_COPY } from '../../config/recipesCopy';
import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { discoveryRecipeServingOverrideId } from '../../config/recipesTabFilters';
import { nutritionLabel } from '../../lib/nutrition';
import {
  scheduleTargetFromDiscoveryRecipe,
  scheduleTargetFromKitchenRecipe,
} from '../../lib/mealCalendar/scheduleTarget';
import type { RecipePantryMatch } from '../../lib/recipeMatch';
import type { Recipe } from '../../types/mealprep';

export interface RecipeDetailSheetProps {
  visible: boolean;
  row: RecipesTabRow | null;
  match: RecipePantryMatch | null | undefined;
  servings: number;
  batchCalculatorEnabled: boolean;
  onClose: () => void;
  onChangeServings: (next: number) => void;
  onAddMissingKitchen: (recipeId: string) => void;
  onAddMissingDiscovery: (recipe: Extract<RecipesTabRow, { kind: 'discovery' }>['recipe']) => void;
}

function kitchenRecipeFromRow(row: Extract<RecipesTabRow, { kind: 'kitchen' }>): Recipe {
  return row.recipe;
}

function stubKitchenFromDiscovery(row: Extract<RecipesTabRow, { kind: 'discovery' }>): Recipe {
  const item = row.recipe;
  return {
    id: discoveryRecipeServingOverrideId(item.id),
    name: item.name,
    tag: item.cuisine,
    description: item.description,
    servings: item.servings,
    minutes: (item.prep_time ?? 0) + (item.cook_time ?? 0),
    calories: item.calories_per_serving,
    protein: item.protein,
    carbs: item.carbs ?? 0,
    fat: item.fat ?? 0,
    ingredients: item.ingredients.map((ing) => ({
      ingredientId: `recipeapi-ing-${ing.id}`,
      name: ing.optional ? `${ing.name} (optional)` : ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
    })),
    steps: item.instructions ?? [],
    isMaster: false,
    createdAt: '',
  };
}

export function RecipeDetailSheet({
  visible,
  row,
  match,
  servings,
  batchCalculatorEnabled,
  onClose,
  onChangeServings,
  onAddMissingKitchen,
  onAddMissingDiscovery,
}: RecipeDetailSheetProps) {
  const insets = useSafeAreaInsets();

  const kitchenRecipe = useMemo(() => {
    if (!row) return null;
    if (row.kind === 'kitchen') return kitchenRecipeFromRow(row);
    return stubKitchenFromDiscovery(row);
  }, [row]);

  const scale =
    kitchenRecipe && kitchenRecipe.servings > 0 ? servings / kitchenRecipe.servings : 1;

  if (!row || !kitchenRecipe) return null;

  const title = kitchenRecipe.name;
  const scheduleTarget =
    row.kind === 'kitchen'
      ? scheduleTargetFromKitchenRecipe(row.recipe)
      : scheduleTargetFromDiscoveryRecipe(row.recipe);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center border-b border-border bg-card px-4 py-3">
          <Pressable onPress={onClose} accessibilityLabel="Close recipe details" className="mr-3 p-1">
            <Ionicons name="close" size={26} color={THEME.ink} />
          </Pressable>
          <Text className="flex-1 text-lg font-bold text-ink" numberOfLines={1}>
            {title}
          </Text>
          <AddToCalendarButton target={scheduleTarget} size={24} className="p-1" />
        </View>

        <ScrollView className="flex-1 px-4 pb-10" keyboardShouldPersistTaps="handled">
          {row.kind === 'kitchen' ? (
            <>
              <Text className="mt-3 text-xs font-semibold uppercase text-primary">{kitchenRecipe.tag}</Text>
              <Text className="text-2xl font-bold text-ink">{kitchenRecipe.name}</Text>
              <Text className="mt-2 text-sm text-muted">{kitchenRecipe.description}</Text>
              <Text className="mt-2 text-xs text-muted">
                {kitchenRecipe.servings} servings · {kitchenRecipe.minutes} min · {nutritionLabel(kitchenRecipe)}
              </Text>
            </>
          ) : (
            <>
              <Text className="mt-3 text-xs font-semibold uppercase text-primary">{row.recipe.cuisine}</Text>
              <Text className="text-2xl font-bold text-ink">{row.recipe.name}</Text>
              <Text className="mt-2 text-sm text-muted">{row.recipe.description}</Text>
              <Text className="mt-2 text-xs text-muted">
                {row.recipe.servings} servings · {row.recipe.prep_time + row.recipe.cook_time} min ·{' '}
                {row.recipe.calories_per_serving} cal
              </Text>
            </>
          )}

          {match ? <RecipePantryMatchBadge match={match} /> : null}

          {match ? (
            <Card title={RECIPES_COPY.pantryCheck.title} className="mt-4">
              <Text className="mt-2 text-sm font-semibold text-primary-dark">{RECIPES_COPY.pantryCheck.youHave}</Text>
              {match.matched.length === 0 ? (
                <Text className="mt-1 text-sm text-muted">{RECIPES_COPY.pantryCheck.noPantryItemsYet}</Text>
              ) : (
                match.matched.map((matchedRow) => (
                  <Text key={matchedRow.ingredient.ingredientId} className="mt-1 text-sm text-muted">
                    ✓ {matchedRow.ingredient.name}
                    {matchedRow.matchedPantryItem ? ` · ${matchedRow.matchedPantryItem.name}` : ''}
                  </Text>
                ))
              )}
              <Text className="mt-4 text-sm font-semibold text-danger">{RECIPES_COPY.pantryCheck.stillNeed}</Text>
              {match.missing.length === 0 ? (
                <Text className="mt-1 text-sm text-muted">{RECIPES_COPY.pantryCheck.readyToCook}</Text>
              ) : (
                match.missing.map((ing) => (
                  <Text key={ing.ingredientId} className="mt-1 text-sm text-muted">
                    · {ing.name}
                  </Text>
                ))
              )}
              {match.missing.length > 0 ? (
                <Pressable
                  onPress={() => {
                    if (row.kind === 'kitchen') onAddMissingKitchen(row.recipe.id);
                    else onAddMissingDiscovery(row.recipe);
                  }}
                  className="mt-4 items-center rounded-xl bg-primary py-3"
                >
                  <Text className="text-sm font-bold text-on-primary">{RECIPES_COPY.pantryCheck.addMissingCta}</Text>
                </Pressable>
              ) : null}
            </Card>
          ) : null}

          {batchCalculatorEnabled && kitchenRecipe.ingredients.length > 0 ? (
            <Card
              title={RECIPES_COPY.batchCalculator.title}
              subtitle={RECIPES_COPY.batchCalculator.scalingSubtitle(kitchenRecipe.name)}
              className="mt-4"
            >
              <Text className="mt-2 text-sm text-muted">
                {RECIPES_COPY.batchCalculator.targetServings(kitchenRecipe.servings)}
              </Text>
              <View className="mt-2 flex-row items-center gap-3">
                <Pressable
                  onPress={() => onChangeServings(Math.max(1, servings - 1))}
                  className="rounded-lg border border-border px-4 py-2"
                >
                  <Text className="font-bold text-ink">−</Text>
                </Pressable>
                <TextInput
                  keyboardType="number-pad"
                  value={String(servings)}
                  onChangeText={(text) => {
                    const n = Number.parseInt(text, 10);
                    if (!Number.isNaN(n)) onChangeServings(Math.max(1, n));
                  }}
                  className="min-w-[64px] rounded-lg border border-border bg-card px-3 py-2 text-center text-lg font-bold text-ink"
                />
                <Pressable
                  onPress={() => onChangeServings(servings + 1)}
                  className="rounded-lg border border-border px-4 py-2"
                >
                  <Text className="font-bold text-ink">+</Text>
                </Pressable>
              </View>
              <Text className="mt-4 text-sm font-semibold text-ink">
                {RECIPES_COPY.batchCalculator.scaledIngredients}
              </Text>
              {kitchenRecipe.ingredients.map((ing) => (
                <Text key={ing.ingredientId} className="mt-1 text-sm text-muted">
                  {ing.name}: {(ing.quantity * scale).toFixed(1)} {ing.unit}
                </Text>
              ))}
            </Card>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
