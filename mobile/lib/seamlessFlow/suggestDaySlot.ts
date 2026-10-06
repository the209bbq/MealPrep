import { MEAL_CALENDAR } from '../../config/mealCalendar';
import { addLocalDays, localDateString } from '../mealCalendar/dates';
import type { MealPlanItem, MealSlot } from '../../types/mealprep';
import { recipeCategoryGroup, type RecipeCategoryGroup } from './categoryGroup';
import { planCodeToMealSlot, type PlanSlotCode } from './planSlots';

export interface SuggestDaySlotInput {
  category?: string | null;
  title?: string | null;
  tags?: string[] | null;
  mealPlan: MealPlanItem[];
  todayIso?: string;
  now?: Date;
}

export interface SuggestDaySlotResult {
  day: string;
  slot: MealSlot;
  slotCode: PlanSlotCode;
  group: RecipeCategoryGroup;
}

const SLOT_PRIOR: Record<RecipeCategoryGroup, Record<PlanSlotCode, number>> = {
  breakfast: { B: 3, L: 0.5, D: 0 },
  light: { B: 0.3, L: 2, D: 1.5 },
  main: { B: 0, L: 1, D: 2 },
  dessert: { B: 0, L: 0.5, D: 2 },
  unknown: { B: 0.3, L: 1, D: 1 },
};

function timeOfDayBonus(now: Date): Record<PlanSlotCode, number> {
  const hour = now.getHours();
  if (hour < 10) return { B: 1, L: 0, D: 0 };
  if (hour < 14) return { B: 0, L: 1, D: 0 };
  if (hour < 20) return { B: 0, L: 0, D: 1 };
  return { B: 0.5, L: 0, D: 0.5 };
}

function slotCutoffPassed(slot: MealSlot, isoDate: string, now: Date): boolean {
  const today = localDateString(now);
  if (isoDate !== today) return false;
  const hour = now.getHours();
  if (slot === 'breakfast' && hour >= 10) return true;
  if (slot === 'lunch' && hour >= 14) return true;
  if (slot === 'dinner' && hour >= 20) return true;
  return false;
}

function occupiedSlots(mealPlan: MealPlanItem[], isoDate: string): Set<MealSlot> {
  const used = new Set<MealSlot>();
  for (const item of mealPlan) {
    if (item.made || item.scheduledOn !== isoDate || !item.mealSlot) continue;
    used.add(item.mealSlot);
  }
  return used;
}

function pickSlotForGroup(group: RecipeCategoryGroup, now: Date): PlanSlotCode {
  const bonus = timeOfDayBonus(now);
  const prior = SLOT_PRIOR[group];
  let best: PlanSlotCode = 'D';
  let bestScore = -Infinity;
  for (const code of ['B', 'L', 'D'] as PlanSlotCode[]) {
    const score = prior[code] + bonus[code];
    if (score > bestScore) {
      bestScore = score;
      best = code;
    }
  }
  return best;
}

/**
 * Default (day, slot) for the plan step. Ghost learning can replace this in a later PR.
 */
export function suggestDaySlot(input: SuggestDaySlotInput): SuggestDaySlotResult {
  const todayIso = input.todayIso ?? localDateString(input.now);
  const now = input.now ?? new Date();
  const group = recipeCategoryGroup({
    category: input.category,
    title: input.title,
    tags: input.tags,
  });
  const preferredCode = pickSlotForGroup(group, now);
  const preferredSlot = planCodeToMealSlot(preferredCode);

  for (let offset = 0; offset < MEAL_CALENDAR.daysAhead; offset += 1) {
    const day = addLocalDays(todayIso, offset);
    const used = occupiedSlots(input.mealPlan, day);
    const candidates: MealSlot[] = [preferredSlot, 'dinner', 'lunch', 'breakfast'];
    for (const slot of candidates) {
      if (used.has(slot)) continue;
      if (slotCutoffPassed(slot, day, now)) continue;
      const code = slot === 'breakfast' ? 'B' : slot === 'lunch' ? 'L' : 'D';
      return { day, slot, slotCode: code, group };
    }
  }

  const fallbackDay = addLocalDays(todayIso, MEAL_CALENDAR.daysAhead - 1);
  return { day: fallbackDay, slot: preferredSlot, slotCode: preferredCode, group };
}

export function takenSlotCodesForDay(
  mealPlan: MealPlanItem[],
  isoDate: string,
): PlanSlotCode[] {
  const used = occupiedSlots(mealPlan, isoDate);
  const codes: PlanSlotCode[] = [];
  if (used.has('breakfast')) codes.push('B');
  if (used.has('lunch')) codes.push('L');
  if (used.has('dinner')) codes.push('D');
  return codes;
}
