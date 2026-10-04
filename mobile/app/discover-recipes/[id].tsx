import { Ionicons } from '../../lib/icons/Ionicons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../../components/Card';
import { AddToCalendarButton } from '../../components/mealCalendar/AddToCalendarButton';
import { RecipePantryMatchBadge } from '../../components/RecipePantryMatch';
import { THEME } from '../../config/appConfig';
import { RECIPES_COPY } from '../../config/recipesCopy';
import { formatIngredientAmount } from '../../lib/formatQuantity';
import { useApp } from '../../context/AppContext';
import { scoreDiscoveryRecipeAgainstPantry } from '../../lib/recipeDiscovery/scorePantry';
import {
  fetchDiscoveryRecipeDetail,
  RecipeDiscoveryAuthError,
  RecipeDiscoveryNotConfiguredError,
} from '../../lib/recipeDiscovery/client';
import { getRecipeDiscoveryAccessToken } from '../../lib/recipeDiscovery/accessToken';
import { recipeApiToAppRecipe } from '../../lib/recipeDiscovery/mapToAppRecipe';
import { isRecipeApiInLibrary } from '../../lib/recipeDiscovery/slugs';
import { scheduleTargetFromDiscoveryRecipe } from '../../lib/mealCalendar/scheduleTarget';
import type { RecipeDiscoveryListItem } from '../../lib/recipeDiscovery/types';
export default function DiscoverRecipeDetailScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const recipeId = Number.parseInt(String(idParam), 10);
  const insets = useSafeAreaInsets();
  const {
    session,
    isAdmin,
    importDiscoveredRecipe,
    recipes,
    profile,
    pantry,
    toggleMealPlanDiscoveryRecipe,
    isOnMealPlan,
    addMissingDiscoveryRecipeIngredientsToGrocery,
    onboarding,
  } = useApp();
  const accessToken = getRecipeDiscoveryAccessToken(session);

  const invalidRecipeId = !Number.isFinite(recipeId);
  const requestKey = invalidRecipeId ? 'invalid' : `${recipeId}:${accessToken ?? 'anon'}`;

  const [loadState, setLoadState] = useState<{
    key: string;
    recipe: RecipeDiscoveryListItem | null;
    error: string | null;
    done: boolean;
  }>({ key: '', recipe: null, error: null, done: false });

  const loading = !invalidRecipeId && (loadState.key !== requestKey || !loadState.done);
  const recipe = invalidRecipeId
    ? null
    : loadState.key === requestKey
      ? loadState.recipe
      : null;
  const error = invalidRecipeId
    ? 'Invalid recipe id'
    : loadState.key === requestKey
      ? loadState.error
      : null;

  const ownerId = profile.id || 'demo-user';
  const alreadyInLibrary =
    Number.isFinite(recipeId) && isRecipeApiInLibrary(recipes, recipeId, ownerId);

  const pantryMatch = useMemo(
    () => (recipe ? scoreDiscoveryRecipeAgainstPantry(recipe, pantry) : null),
    [recipe, pantry],
  );

  useEffect(() => {
    if (invalidRecipeId) return;
    let cancelled = false;
    void (async () => {
      try {
        const detail = await fetchDiscoveryRecipeDetail(recipeId, accessToken);
        if (cancelled) return;
        setLoadState({ key: requestKey, recipe: detail, error: null, done: true });
        onboarding.notifyTutorialStepComplete('recipes');
      } catch (err) {
        if (cancelled) return;
        let message = 'Could not load recipe';
        if (err instanceof RecipeDiscoveryNotConfiguredError) {
          message = 'Recipe discovery is not set up on the server yet.';
        } else if (err instanceof RecipeDiscoveryAuthError) {
          message = err.message;
        } else if (err instanceof Error) {
          message = err.message;
        }
        setLoadState({ key: requestKey, recipe: null, error: message, done: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, invalidRecipeId, onboarding, recipeId, requestKey]);

  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const onImport = async () => {
    if (!recipe) return;
    setImporting(true);
    setImportError(null);
    try {
      const mapped = recipeApiToAppRecipe(recipe, { asMaster: isAdmin, userId: ownerId });
      await importDiscoveredRecipe(mapped, { asMaster: isAdmin, recipeApiId: recipeId });
      setImported(true);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center border-b border-border bg-card px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-3 p-1">
          <Ionicons name="chevron-back" size={24} color={THEME.ink} />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-ink">Recipe details</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={THEME.primary} size="large" />
        </View>
      ) : null}

      {error && !recipe ? (
        <View className="p-4">
          <Text className="text-sm text-danger">{error}</Text>
        </View>
      ) : null}

      {recipe ? (
        <ScrollView className="flex-1 px-4 pb-10">
          {recipe.isDemoSample ? (
            <Text className="mt-4 text-[10px] font-bold uppercase text-amber-700">Demo sample — not from live search</Text>
          ) : null}
          <Text className="mt-2 text-xs font-semibold uppercase text-primary">{recipe.cuisine}</Text>
          <Text className="text-2xl font-bold text-ink">{recipe.name}</Text>
          <View className="mt-1 flex-row items-center">
            <AddToCalendarButton target={scheduleTargetFromDiscoveryRecipe(recipe)} size={24} className="p-1" />
          </View>
          <Text className="mt-2 text-sm text-muted">{recipe.description}</Text>
          <Text className="mt-3 text-sm text-ink">
            {recipe.servings} servings · {recipe.prep_time + recipe.cook_time} min ·{' '}
            {recipe.calories_per_serving} cal · {recipe.protein}g protein
            {recipe.carbs != null ? ` · ${recipe.carbs}g carbs` : ''}
            {recipe.fat != null ? ` · ${recipe.fat}g fat` : ''}
          </Text>
          {pantryMatch ? <RecipePantryMatchBadge match={pantryMatch} /> : null}

          <Card title="Ingredients" className="mt-4">
            {recipe.ingredients.map((ing) => (
              <Text key={ing.id} className="mt-1 text-sm text-muted">
                {formatIngredientAmount(ing.quantity, ing.unit, ing.name)}
                {ing.optional ? ' (optional)' : ''}
              </Text>
            ))}
          </Card>

          <Card title="Steps" className="mt-4">
            {recipe.instructions.map((step, index) => (
              <Text key={index} className="mt-2 text-sm text-muted">
                {index + 1}. {step}
              </Text>
            ))}
          </Card>

          <Card title="Nutrition (per serving)" className="mt-4">
            <Text className="text-sm text-muted">
              {recipe.calories_per_serving} cal · {recipe.protein}g protein
              {recipe.carbs != null ? ` · ${recipe.carbs}g carbs` : ''}
              {recipe.fat != null ? ` · ${recipe.fat}g fat` : ''}
            </Text>
            <Text className="mt-2 text-xs text-muted">Source: online recipe catalog</Text>
          </Card>

          {importError ? <Text className="mt-3 text-sm text-danger">{importError}</Text> : null}

          {pantryMatch && pantryMatch.missingCount > 0 ? (
            <Pressable
              onPress={() => addMissingDiscoveryRecipeIngredientsToGrocery(recipe)}
              className="mt-6 items-center rounded-xl bg-primary px-4 py-4"
            >
              <Text className="text-center text-base font-bold text-on-primary">
                {RECIPES_COPY.pantryCheck.addMissingCta}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => void toggleMealPlanDiscoveryRecipe(recipe)}
            className={`mt-6 rounded-xl px-4 py-4 ${isOnMealPlan({ recipeApiId: recipeId }) ? 'bg-sand' : 'bg-slate'}`}
          >
            <Text className="text-center text-base font-bold text-on-primary">
              {isOnMealPlan({ recipeApiId: recipeId }) ? 'Remove from meals to make' : 'Add to meals'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => void onImport()}
            disabled={importing || imported || alreadyInLibrary}
            className={`mt-3 rounded-xl px-4 py-4 ${imported || alreadyInLibrary ? 'bg-sand' : 'bg-primary'}`}
          >
            <Text className={`text-center text-base font-bold ${imported || alreadyInLibrary ? 'text-muted' : 'text-on-primary'}`}>
              {importing
                ? 'Saving…'
                : alreadyInLibrary || imported
                  ? 'In your recipe library'
                  : isAdmin
                    ? 'Add to kitchen catalog'
                    : 'Add to my recipes'}
            </Text>
          </Pressable>
          {!isAdmin ? (
            <Text className="mt-2 text-center text-xs text-muted">
              Saved as your personal recipe (visible to you). Admins can publish to the shared catalog.
            </Text>
          ) : null}
        </ScrollView>
      ) : null}
    </View>
  );
}
