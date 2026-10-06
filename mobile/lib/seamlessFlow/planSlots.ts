import type { MealSlot } from '../../types/mealprep';

/** Meal-plan slots shown in the seamless flow (no snack). */
export const SEAMLESS_PLAN_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

export type PlanSlotCode = 'B' | 'L' | 'D';

export function mealSlotToPlanCode(slot: MealSlot): PlanSlotCode | null {
  if (slot === 'breakfast') return 'B';
  if (slot === 'lunch') return 'L';
  if (slot === 'dinner') return 'D';
  return null;
}

export function planCodeToMealSlot(code: PlanSlotCode): MealSlot {
  if (code === 'B') return 'breakfast';
  if (code === 'L') return 'lunch';
  return 'dinner';
}
