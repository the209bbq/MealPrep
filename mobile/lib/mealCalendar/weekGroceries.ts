import { resolveMealPlanRecipeId } from '../mealPlan/resolve';
import type { MealPlanItem, Recipe } from '../../types/mealprep';
import { addLocalDays } from './dates';
import { MEAL_CALENDAR } from '../../config/mealCalendar';

/** Active scheduled meals in the next `dayCount` local days (excludes leftover rows). */
export function mealPlanItemsInWeekWindow(
  mealPlan: MealPlanItem[],
  startIso: string,
  dayCount: number = MEAL_CALENDAR.daysAhead,
): MealPlanItem[] {
  const endIso = addLocalDays(startIso, dayCount - 1);
  return mealPlan.filter(
    (item) =>
      !item.made &&
      item.scheduledOn != null &&
      !item.leftoverOfId &&
      item.scheduledOn >= startIso &&
      item.scheduledOn <= endIso,
  );
}

export function recipeIdsForScheduledMeals(
  items: MealPlanItem[],
  recipes: Recipe[],
  userId: string,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const recipeId = resolveMealPlanRecipeId(item, recipes, userId);
    if (!recipeId || seen.has(recipeId)) continue;
    seen.add(recipeId);
    ids.push(recipeId);
  }
  return ids;
}
