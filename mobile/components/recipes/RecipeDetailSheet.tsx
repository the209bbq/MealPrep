import { Ionicons } from '../../lib/icons/Ionicons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { VIRAL_RECIPES_COPY } from '../../config/viralRecipes';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddToCalendarButton } from '../mealCalendar/AddToCalendarButton';
import { THEME } from '../../config/appConfig';
import { RECIPES_COPY } from '../../config/recipesCopy';
import { RECIPE_IMPORT_COPY } from '../../config/recipeImport';
import { RecipeSourceCreditLine } from './RecipeSourceCreditLine';
import { RecipeThumbnail } from './RecipeThumbnail';
import { RECIPE_IMAGE } from '../../config/recipeImages';
import { sourceCreditFromRecipe } from '../../lib/recipeImport/sourceCredit';
import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { discoveryRecipeServingOverrideId } from '../../config/recipesTabFilters';
import {
  resolveDiscoveryRecipeImageUrl,
  resolveKitchenRecipeImageUrl,
} from '../../lib/recipes/recipeImageUrl';
import {
  scheduleTargetFromDiscoveryRecipe,
  scheduleTargetFromKitchenRecipe,
} from '../../lib/mealCalendar/scheduleTarget';
import type { RecipePantryMatch } from '../../lib/recipeMatch';
import { LIBRARY_RECIPES } from '../../config/libraryRecipes';
import { isLibraryRecipeAppId } from '../../lib/libraryRecipes/slug';
import { isMealDbRecipeId } from '../../lib/mealdb/normalize';
import { MealDbRecipeCreditLine } from './MealDbRecipeCreditLine';
import type { Recipe } from '../../types/mealprep';
import type { RecipeDiscoveryListItem } from '../../lib/recipeDiscovery/types';

export interface RecipeDetailSheetProps {
  visible: boolean;
  row: RecipesTabRow | null;
  match: RecipePantryMatch | null | undefined;
  servings: number;
  batchCalculatorEnabled: boolean;
  onClose: () => void;
  onChangeServings: (next: number) => void;
  onAddMissingKitchen: (recipeId: string, matchOverride?: RecipePantryMatch) => void;
  onAddMissingDiscovery: (recipe: RecipeDiscoveryListItem) => void;
  isOnMealPlan: (options: { recipeSlug?: string; recipeApiId?: number }) => boolean;
  onToggleKitchen: (recipeId: string) => void;
  onToggleDiscovery: (recipe: RecipeDiscoveryListItem) => void;
  /** Viral tap-to-import: show spinner in ingredients/steps while recipe-import runs. */
  importing?: boolean;
  importError?: string | null;
  onRetryImport?: () => void;
  onSignInForImport?: () => void;
}

type DetailSection = 'ingredients' | 'steps';

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
    imageUrl: resolveDiscoveryRecipeImageUrl(item),
  };
}

function SectionToggle({
  section,
  onSection,
}: {
  section: DetailSection;
  onSection: (next: DetailSection) => void;
}) {
  const tabs: { id: DetailSection; label: string }[] = [
    { id: 'ingredients', label: RECIPES_COPY.recipeDetail.ingredientsTab },
    { id: 'steps', label: RECIPES_COPY.recipeDetail.stepsTab },
  ];
  return (
    <View className="mt-4 flex-row rounded-lg border border-border bg-paper p-0.5">
      {tabs.map((tab) => {
        const selected = section === tab.id;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onSection(tab.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`flex-1 items-center rounded-md py-2 ${selected ? 'bg-card' : ''}`}
          >
            <Text className={`text-sm font-semibold ${selected ? 'text-ink' : 'text-muted'}`}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
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
  isOnMealPlan,
  onToggleKitchen,
  onToggleDiscovery,
  importing = false,
  importError = null,
  onRetryImport,
  onSignInForImport,
}: RecipeDetailSheetProps) {
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<DetailSection>('ingredients');

  const kitchenRecipe = useMemo(() => {
    if (!row) return null;
    if (row.kind === 'kitchen') return kitchenRecipeFromRow(row);
    return stubKitchenFromDiscovery(row);
  }, [row]);

  const scale =
    kitchenRecipe && kitchenRecipe.servings > 0 ? servings / kitchenRecipe.servings : 1;

  if (!row || !kitchenRecipe) return null;

  const heroUri =
    row.kind === 'kitchen'
      ? resolveKitchenRecipeImageUrl(row.recipe)
      : resolveDiscoveryRecipeImageUrl(row.recipe);

  const sourceCredit = row.kind === 'kitchen' ? sourceCreditFromRecipe(row.recipe) : null;
  const minutes =
    row.kind === 'kitchen'
      ? row.recipe.minutes
      : (row.recipe.prep_time ?? 0) + (row.recipe.cook_time ?? 0);

  const scheduleTarget =
    row.kind === 'kitchen'
      ? scheduleTargetFromKitchenRecipe(row.recipe)
      : scheduleTargetFromDiscoveryRecipe(row.recipe);

  const isMealDbCatalog =
    row.kind === 'kitchen' && (isMealDbRecipeId(row.recipe.id) || row.recipe.sourceType === 'themealdb');

  const onPlan =
    row.kind === 'kitchen' && !isMealDbCatalog
      ? isOnMealPlan({ recipeSlug: row.recipe.id })
      : row.kind === 'discovery'
        ? isOnMealPlan({ recipeApiId: row.recipe.id })
        : false;

  const missingCount = match?.missingCount ?? 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center border-b border-border bg-card px-3 py-2">
          <Pressable onPress={onClose} accessibilityLabel="Close recipe details" className="p-2">
            <Ionicons name="close" size={24} color={THEME.ink} />
          </Pressable>
          <Text className="flex-1 text-center text-sm font-semibold text-muted" numberOfLines={1}>
            Recipe
          </Text>
          <View className="w-10" />
        </View>

        <ScrollView className="flex-1 pb-10" keyboardShouldPersistTaps="handled">
          <RecipeThumbnail
            uri={heroUri}
            accessibilityLabel={`Photo for ${kitchenRecipe.name}`}
            aspectRatio={RECIPE_IMAGE.aspectRatio}
            className="rounded-none"
          />

          <View className="px-4 pt-3">
            <Text className="text-xl font-bold text-ink">{kitchenRecipe.name}</Text>

            {row.kind === 'kitchen' && isLibraryRecipeAppId(row.recipe.id) ? (
              <Text className="mt-1 text-xs text-muted">{LIBRARY_RECIPES.detailTag}</Text>
            ) : null}

            {row.kind === 'kitchen' && isMealDbCatalog ? (
              <MealDbRecipeCreditLine recipe={row.recipe} className="mt-1" />
            ) : null}

            {row.kind === 'kitchen' &&
            !isMealDbCatalog &&
            (sourceCredit?.creatorName || sourceCredit?.originalUrl) ? (
              <RecipeSourceCreditLine
                creatorName={sourceCredit.creatorName}
                creatorUrl={sourceCredit.creatorUrl}
                originalUrl={sourceCredit.originalUrl}
                className="mt-1"
              />
            ) : null}

            <Text className="mt-1 text-xs text-muted">
              {RECIPES_COPY.recipeDetail.servingsAndTime(servings, minutes)}
            </Text>

            <View className="mt-3 flex-row flex-wrap items-center gap-2">
              {!isMealDbCatalog ? (
                <Pressable
                  onPress={() => {
                    if (importing) return;
                    if (row.kind === 'kitchen') void onToggleKitchen(row.recipe.id);
                    else void onToggleDiscovery(row.recipe);
                  }}
                  disabled={importing}
                  className={`rounded-full px-3 py-1.5 ${onPlan ? 'bg-primary' : 'border border-border bg-card'}`}
                  accessibilityRole="button"
                  accessibilityLabel={
                    onPlan ? RECIPES_COPY.mealPlanChip.onPlan : RECIPES_COPY.mealPlanChip.add
                  }
                >
                  <Text className={`text-xs font-bold ${onPlan ? 'text-on-primary' : 'text-ink'}`}>
                    {onPlan ? RECIPES_COPY.mealPlanChip.onPlan : RECIPES_COPY.mealPlanChip.add}
                  </Text>
                </Pressable>
              ) : null}
              <AddToCalendarButton target={scheduleTarget} size={20} className="rounded-full border border-border bg-card p-2" />
              {!importing && missingCount > 0 ? (
                <Pressable
                  onPress={() => {
                    if (row.kind === 'kitchen') onAddMissingKitchen(row.recipe.id, match ?? undefined);
                    else onAddMissingDiscovery(row.recipe);
                  }}
                  className="rounded-full border border-primary bg-primary-light px-3 py-1.5"
                  accessibilityRole="button"
                >
                  <Text className="text-xs font-bold text-primary-dark">
                    {RECIPES_COPY.recipeCard.addMissingCta}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {importing ? (
              <View className="mt-3 flex-row items-center gap-2">
                <ActivityIndicator color={THEME.primary} size="small" />
                <Text className="text-sm text-muted">{VIRAL_RECIPES_COPY.detailImporting}</Text>
              </View>
            ) : null}
            {importError ? (
              <View className="mt-3">
                <Text className="text-sm text-muted">{importError}</Text>
                {onRetryImport ? (
                  <Pressable onPress={onRetryImport} className="mt-2 self-start rounded-lg border border-border px-3 py-2">
                    <Text className="text-xs font-bold text-primary">Try again</Text>
                  </Pressable>
                ) : null}
                {onSignInForImport ? (
                  <Pressable
                    onPress={onSignInForImport}
                    className="mt-2 self-start rounded-lg bg-primary px-3 py-2"
                  >
                    <Text className="text-xs font-bold text-on-primary">{RECIPE_IMPORT_COPY.guestSignInCta}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <SectionToggle section={section} onSection={setSection} />

            {section === 'ingredients' ? (
              <View className="mt-3">
                {batchCalculatorEnabled && kitchenRecipe.ingredients.length > 0 ? (
                  <View className="mb-3 flex-row items-center gap-2">
                    <Text className="text-xs font-semibold text-muted">Servings</Text>
                    <Pressable
                      onPress={() => onChangeServings(Math.max(1, servings - 1))}
                      className="rounded-md border border-border px-2.5 py-1"
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
                      className="min-w-[48px] rounded-md border border-border bg-card px-2 py-1 text-center text-sm font-bold text-ink"
                    />
                    <Pressable
                      onPress={() => onChangeServings(servings + 1)}
                      className="rounded-md border border-border px-2.5 py-1"
                    >
                      <Text className="font-bold text-ink">+</Text>
                    </Pressable>
                  </View>
                ) : null}
                {importing ? (
                  <Text className="text-sm text-muted">{VIRAL_RECIPES_COPY.detailImporting}</Text>
                ) : kitchenRecipe.ingredients.length === 0 ? (
                  <Text className="text-sm text-muted">No ingredients listed.</Text>
                ) : (
                  kitchenRecipe.ingredients.map((ing) => (
                    <Text key={ing.ingredientId} className="mt-2 text-sm leading-6 text-ink">
                      · {ing.name}
                      {batchCalculatorEnabled
                        ? `: ${(ing.quantity * scale).toFixed(1)} ${ing.unit}`
                        : ing.quantity > 0
                          ? ` — ${ing.quantity} ${ing.unit}`
                          : ''}
                    </Text>
                  ))
                )}
              </View>
            ) : (
              <View className="mt-3">
                {importing ? (
                  <Text className="text-sm text-muted">{VIRAL_RECIPES_COPY.detailImporting}</Text>
                ) : kitchenRecipe.steps.length === 0 ? (
                  <Text className="text-sm text-muted">
                    {kitchenRecipe.sourceUrl ? RECIPE_IMPORT_COPY.noSteps : 'No steps listed.'}
                  </Text>
                ) : (
                  kitchenRecipe.steps.map((step, index) => (
                    <View key={`${index}-${step.slice(0, 24)}`} className="mt-3 flex-row">
                      <Text className="mr-2 w-6 text-sm font-bold text-primary">{index + 1}.</Text>
                      <Text className="flex-1 text-sm leading-6 text-ink">{step}</Text>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
