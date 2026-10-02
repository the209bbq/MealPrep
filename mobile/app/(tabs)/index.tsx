import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { GuestSaveNudge } from '../../components/GuestSaveNudge';
import { InstallAppBanner } from '../../components/InstallAppBanner';
import { MealMadeReviewSheet } from '../../components/MealMadeReviewSheet';
import { MealWeekCalendarCard } from '../../components/mealCalendar/MealWeekCalendarCard';
import { NextStepCard } from '../../components/NextStepCard';
import { useApp } from '../../context/AppContext';
import { resolveHomeNextStep } from '../../lib/home/nextStep';

export default function HomeScreen() {
  const {
    demoMode,
    pantry,
    grocery,
    pantryRecipeMatches,
    closeMealMadeReview,
    toggleMealMadePantryUse,
    confirmMealMade,
    mealMadeReview,
    mealMadeReviewTitle,
    mealMadeReviewRows,
    mealMadeBusy,
    addMissingRecipeIngredientsToGrocery,
  } = useApp();

  const openGroceryCount = useMemo(() => grocery.filter((g) => !g.checked).length, [grocery]);

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
        <GuestSaveNudge />

        <NextStepCard step={nextStep} onPress={handleNextStep} />

        <MealWeekCalendarCard />

        {demoMode ? (
          <Text className="mt-3 text-xs text-muted">
            Demo mode — local data only until you sign in with a connected account.
          </Text>
        ) : null}
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
