import type { MealPlanItem, MealSlot } from '../../types/mealprep';

/** Local hour (0–23) after which we may ask if a planned meal was cooked. */
const SLOT_PROMPT_AFTER_HOUR: Record<MealSlot, number> = {
  breakfast: 10,
  lunch: 14,
  dinner: 20,
  snack: 16,
};

export type CookConfirmVia = 'planned' | 'cook_now';

export function cookPromptKeyForMeal(mealPlanItemId: string): string {
  return `meal:${mealPlanItemId}`;
}

export function cookPromptKeyForCookNow(recipeId: string, sheetId: string | null): string {
  return sheetId ? `cooknow:${sheetId}` : `cooknow:${recipeId}`;
}

function parseLocalDateParts(isoDate: string): { y: number; m: number; d: number } | null {
  const parts = isoDate.split('-').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return { y: parts[0]!, m: parts[1]!, d: parts[2]! };
}

export function localDateStringFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Deadline (local) when a planned meal becomes eligible for the cook prompt. */
export function plannedMealPromptEligibleAt(
  scheduledOn: string,
  mealSlot: MealSlot | null,
  now: Date = new Date(),
): Date | null {
  if (!mealSlot) return null;
  const parts = parseLocalDateParts(scheduledOn);
  if (!parts) return null;
  const hour = SLOT_PROMPT_AFTER_HOUR[mealSlot];
  return new Date(parts.y, parts.m - 1, parts.d, hour, 0, 0, 0);
}

export function isPlannedMealPromptDue(
  item: Pick<MealPlanItem, 'scheduledOn' | 'mealSlot' | 'made'>,
  now: Date = new Date(),
): boolean {
  if (item.made || !item.scheduledOn || !item.mealSlot) return false;
  const eligibleAt = plannedMealPromptEligibleAt(item.scheduledOn, item.mealSlot, now);
  if (!eligibleAt) return false;
  return now.getTime() >= eligibleAt.getTime();
}

export function pickDuePlannedMeal(
  mealPlan: MealPlanItem[],
  askedKeys: ReadonlySet<string>,
  now: Date = new Date(),
): MealPlanItem | null {
  const candidates = mealPlan
    .filter((item) => !item.made && item.scheduledOn && item.mealSlot)
    .filter((item) => isPlannedMealPromptDue(item, now))
    .filter((item) => !askedKeys.has(cookPromptKeyForMeal(item.id)));

  candidates.sort((a, b) => {
    const aAt = plannedMealPromptEligibleAt(a.scheduledOn!, a.mealSlot!, now)?.getTime() ?? 0;
    const bAt = plannedMealPromptEligibleAt(b.scheduledOn!, b.mealSlot!, now)?.getTime() ?? 0;
    return aAt - bAt;
  });

  return candidates[0] ?? null;
}
