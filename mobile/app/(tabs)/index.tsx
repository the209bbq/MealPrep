import { ScrollView, Text, View } from 'react-native';
import { GuestSaveNudge } from '../../components/GuestSaveNudge';
import { InstallAppBanner } from '../../components/InstallAppBanner';
import { MealMadeReviewSheet } from '../../components/MealMadeReviewSheet';
import { HomeMyRecipesStrip } from '../../components/home/HomeMyRecipesStrip';
import { MealWeekCalendarCard } from '../../components/mealCalendar/MealWeekCalendarCard';
import { useApp } from '../../context/AppContext';

export default function HomeScreen() {
  const {
    demoMode,
    closeMealMadeReview,
    toggleMealMadePantryUse,
    confirmMealMade,
    mealMadeReview,
    mealMadeReviewTitle,
    mealMadeReviewRows,
    mealMadeBusy,
  } = useApp();

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 bg-paper px-4 pb-8" contentContainerStyle={{ paddingBottom: 24 }}>
        <InstallAppBanner />
        <GuestSaveNudge />

        <HomeMyRecipesStrip />

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
