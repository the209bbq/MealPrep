import type { MealPlanItem, MealSlot } from '../../types/mealprep';
import { emptyEngagementIndexForGhost } from '../recipeRanking/engagementIndexHelpers';
import type { EngagementIndexV2 } from '../recipeRanking/engagementIndex';
import { recipeCategoryGroup, type RecipeCategoryGroup } from './categoryGroup';
import { guessGhostDaySlot } from './ghostGuesser';
import type { PlanSlotCode } from './planSlots';
import { planCodeToMealSlot } from './planSlots';

export interface SuggestDaySlotInput {
  category?: string | null;
  title?: string | null;
  tags?: string[] | null;
  mealPlan: MealPlanItem[];
  todayIso?: string;
  now?: Date;
  ghostIndex?: EngagementIndexV2;
}

export interface SuggestDaySlotResult {
  day: string;
  slot: MealSlot;
  slotCode: PlanSlotCode;
  group: RecipeCategoryGroup;
  slotProb: number;
  showSlotGhost: boolean;
  compactPrompt: boolean;
}

export function suggestDaySlot(input: SuggestDaySlotInput): SuggestDaySlotResult {
  const index = input.ghostIndex ?? emptyEngagementIndexForGhost(input.now);
  return guessGhostDaySlot({ ...input, index });
}

export function takenSlotCodesForDay(
  mealPlan: MealPlanItem[],
  isoDate: string,
): PlanSlotCode[] {
  const used = new Set<MealSlot>();
  for (const item of mealPlan) {
    if (item.made || item.scheduledOn !== isoDate || !item.mealSlot) continue;
    used.add(item.mealSlot);
  }
  const codes: PlanSlotCode[] = [];
  if (used.has('breakfast')) codes.push('B');
  if (used.has('lunch')) codes.push('L');
  if (used.has('dinner')) codes.push('D');
  return codes;
}

export { planCodeToMealSlot };
