import { useApp } from '../context/AppContext';
import { MealMadeReviewSheet } from './MealMadeReviewSheet';

export function MealMadeReviewOverlay() {
  const {
    mealMadeReview,
    mealMadeReviewTitle,
    mealMadeReviewRows,
    mealMadeBusy,
    closeMealMadeReview,
    toggleMealMadePantryUse,
    confirmMealMade,
  } = useApp();

  return (
    <MealMadeReviewSheet
      visible={mealMadeReview != null}
      mealTitle={mealMadeReviewTitle ?? 'Made it'}
      rows={mealMadeReviewRows}
      selectedPantryIds={mealMadeReview?.selectedPantryIds ?? new Set()}
      onTogglePantryItem={toggleMealMadePantryUse}
      onConfirm={() => void confirmMealMade()}
      onCancel={closeMealMadeReview}
      busy={mealMadeBusy}
    />
  );
}
