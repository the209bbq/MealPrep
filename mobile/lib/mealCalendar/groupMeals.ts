import type { MealPlanItem, MealSlot } from '../../types/mealprep';
import { MEAL_SLOTS } from '../../types/mealprep';
import { buildLocalDayRange } from './dates';

const SLOT_ORDER: Record<MealSlot, number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
};

export function compareScheduledMeals(a: MealPlanItem, b: MealPlanItem): number {
  const slotA = a.mealSlot ? SLOT_ORDER[a.mealSlot] : 99;
  const slotB = b.mealSlot ? SLOT_ORDER[b.mealSlot] : 99;
  if (slotA !== slotB) return slotA - slotB;
  return a.title.localeCompare(b.title);
}

export function activeScheduledMeals(mealPlan: MealPlanItem[]): MealPlanItem[] {
  return mealPlan.filter((item) => !item.made && item.scheduledOn != null);
}

export function unscheduledActiveMeals(mealPlan: MealPlanItem[]): MealPlanItem[] {
  return mealPlan.filter((item) => !item.made && item.scheduledOn == null);
}

export function mealsForLocalDate(mealPlan: MealPlanItem[], isoDate: string): MealPlanItem[] {
  return activeScheduledMeals(mealPlan)
    .filter((item) => item.scheduledOn === isoDate)
    .sort(compareScheduledMeals);
}

export function groupMealsByDay(
  mealPlan: MealPlanItem[],
  dayCount: number,
  startIso?: string,
): { day: ReturnType<typeof buildLocalDayRange>[number]; meals: MealPlanItem[] }[] {
  const days = buildLocalDayRange(dayCount, startIso);
  return days.map((day) => ({
    day,
    meals: mealsForLocalDate(mealPlan, day.isoDate),
  }));
}

export function nextMealSlotForDate(existing: MealPlanItem[], isoDate: string): MealSlot {
  const used = new Set(existing.filter((m) => m.scheduledOn === isoDate).map((m) => m.mealSlot));
  for (const slot of MEAL_SLOTS) {
    if (!used.has(slot)) return slot;
  }
  return 'dinner';
}
