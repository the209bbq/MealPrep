import { HydrationSafeIonicon } from '../../components/HydrationSafeIonicon';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { usePantryDiscoverySuggestions } from '../../hooks/usePantryDiscoverySuggestions';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { CookFromPantryCard } from '../../components/RecipePantryMatch';
import { InstallAppBanner } from '../../components/InstallAppBanner';
import { MealMadeReviewSheet } from '../../components/MealMadeReviewSheet';
import { MealWeekCalendarCard } from '../../components/mealCalendar/MealWeekCalendarCard';
import { MealsToMakePanel } from '../../components/MealsToMakePanel';
import { NextStepCard } from '../../components/NextStepCard';
import { TabEmptyState } from '../../components/onboarding/TabEmptyState';
import { THEME } from '../../config/appConfig';
import { useApp } from '../../context/AppContext';
import { unscheduledActiveMeals } from '../../lib/mealCalendar/groupMeals';
import { resolveHomeNextStep } from '../../lib/home/nextStep';

export default function HomeScreen() {
  const {
    demoMode,
    pantry,
    grocery,
    pantryRecipeRecommendations,
    pantryRecipeMatches,
    mealPlan,
    removeMealPlanItem,
    openMealMadeReview,
    closeMealMadeReview,
    toggleMealMadePantryUse,
    confirmMealMade,
    undoLastMealMade,
    mealMadeReview,
    mealMadeReviewTitle,
    mealMadeReviewRows,
    mealMadeBusy,
    addMissingForPlannedMealsToGrocery,
    addMissingRecipeIngredientsToGrocery,
    session,
  } = useApp();

  const openGroceryCount = useMemo(() => grocery.filter((g) => !g.checked).length, [grocery]);
  const unscheduledMeals = useMemo(() => unscheduledActiveMeals(mealPlan), [mealPlan]);

  const pantryDiscoveryEnabled = pantry.length > 0 && pantryRecipeRecommendations.length === 0;
  const { suggestions: pantryDiscoverySuggestions } = usePantryDiscoverySuggestions(pantry, session, {
    enabled: pantryDiscoveryEnabled,
  });
  const cookFromPantryRecommendations = useMemo(() => {
    if (pantryRecipeRecommendations.length > 0) return pantryRecipeRecommendations;
    return pantryDiscoverySuggestions.slice(0, 3).map((row) => row.match);
  }, [pantryDiscoverySuggestions, pantryRecipeRecommendations]);

  const nextStep = useMemo(
    () =>
      resolveHomeNextStep({
        pantryItemCount: pantry.length,
        openGroceryCount,
        rankedMatches: pantryRecipeMatches.ranked,
      }),
    [openGroceryCount, pantry.length, pantryRecipeMatches.ranked],
  );

  function handleNextStep() {
    switch (nextStep.kind) {
      case 'scan_pantry':
      case 'build_pantry':
        router.push('/pantry');
        break;
      case 'shop_list':
        router.push('/smart-shop');
        break;
      case 'add_missing':
        if (nextStep.recipeId) addMissingRecipeIngredientsToGrocery(nextStep.recipeId);
        break;
      case 'cook_recipe':
        if (nextStep.recipeId) {
          router.push({ pathname: '/recipes', params: { recipeId: nextStep.recipeId } });
        } else {
          router.push('/recipes');
        }
        break;
      default:
        router.push('/pantry');
    }
  }

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 bg-paper px-4 pb-8" contentContainerStyle={{ paddingBottom: 24 }}>
        <InstallAppBanner />

        <View className="mt-4 flex-row gap-3">
          {[
            { label: 'Scan', route: '/pantry' as const, icon: 'camera' as const },
            { label: 'Cook', route: '/recipes' as const, icon: 'flame' as const },
            { label: 'Shop', route: '/grocery' as const, icon: 'cart' as const },
          ].map((action) => (
            <Pressable
              key={action.label}
              onPress={() => router.push(action.route)}
              className="flex-1 items-center rounded-2xl border border-border bg-card py-4"
            >
              <HydrationSafeIonicon name={action.icon} size={24} color={THEME.primary} />
              <Text className="mt-2 text-sm font-bold text-ink">{action.label}</Text>
            </Pressable>
          ))}
        </View>

        {pantry.length === 0 ? (
          <TabEmptyState tab="home" className="mt-4" />
        ) : (
          <NextStepCard step={nextStep} onPress={handleNextStep} />
        )}

        <MealWeekCalendarCard />

        {demoMode ? (
          <Text className="mt-3 text-xs text-muted">Demo mode — local data only until you sign in with a connected account.</Text>
        ) : null}

        <MealsToMakePanel
          items={unscheduledMeals}
          onRemove={(id) => void removeMealPlanItem(id)}
          onMarkMade={openMealMadeReview}
          onUndoMade={(id) => void undoLastMealMade(id)}
          onAddMissingToGrocery={addMissingForPlannedMealsToGrocery}
        />

        <CookFromPantryCard
          recommendations={cookFromPantryRecommendations}
          onOpenRecipe={(recipeId) => {
            if (recipeId.startsWith('recipeapi-')) {
              const apiId = Number.parseInt(recipeId.replace(/^recipeapi-(\d+).*/, '$1'), 10);
              if (Number.isFinite(apiId)) {
                router.push(`/discover-recipes/${apiId}`);
                return;
              }
            }
            router.push({ pathname: '/recipes', params: { recipeId } });
          }}
          onAddMissing={(recipeId) => addMissingRecipeIngredientsToGrocery(recipeId)}
        />
      </ScrollView>

      <MealMadeReviewSheet
        visible={mealMadeReview != null}
        mealTitle={mealMadeReviewTitle ?? 'Meal'}
        rows={mealMadeReviewRows}
        selectedPantryIds={mealMadeReview?.selectedPantryIds ?? new Set()}
        onTogglePantryItem={toggleMealMadePantryUse}
        onConfirm={() => void confirmMealMade()}
        onCancel={closeMealMadeReview}
        busy={mealMadeBusy}
      />

    </View>
  );
}
