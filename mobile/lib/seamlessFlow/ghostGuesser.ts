import { MEAL_CALENDAR } from '../../config/mealCalendar';
import { addLocalDays, localDateString } from '../mealCalendar/dates';
import type { MealPlanItem, MealSlot } from '../../types/mealprep';
import type { EngagementIndexV2 } from '../recipeRanking/engagementIndex';
import { recipeCategoryGroup, type RecipeCategoryGroup } from './categoryGroup';
import { planCodeToMealSlot, type PlanSlotCode } from './planSlots';

export interface GhostGuesserInput {
  category?: string | null;
  title?: string | null;
  tags?: string[] | null;
  mealPlan: MealPlanItem[];
  todayIso?: string;
  now?: Date;
  index: EngagementIndexV2;
}

export interface GhostGuesserResult {
  day: string;
  slot: MealSlot;
  slotCode: PlanSlotCode;
  group: RecipeCategoryGroup;
  slotProb: number;
  showSlotGhost: boolean;
  compactPrompt: boolean;
}

const SLOT_PRIOR: Record<RecipeCategoryGroup, Record<PlanSlotCode, number>> = {
  breakfast: { B: 3, L: 0.5, D: 0 },
  light: { B: 0.3, L: 2, D: 1.5 },
  main: { B: 0, L: 1, D: 2 },
  dessert: { B: 0, L: 0.5, D: 2 },
  unknown: { B: 0.3, L: 1, D: 1 },
};

/** Small nudge only — recipe category/title signals dominate via SLOT_PRIOR. */
function timeOfDayBonus(now: Date): Record<PlanSlotCode, number> {
  const hour = now.getHours();
  if (hour < 10) return { B: 0.2, L: 0, D: 0 };
  if (hour < 14) return { B: 0, L: 0.2, D: 0 };
  if (hour < 20) return { B: 0, L: 0, D: 0.2 };
  return { B: 0.1, L: 0, D: 0.1 };
}

function softmax(values: Record<PlanSlotCode, number>): Record<PlanSlotCode, number> {
  const codes = ['B', 'L', 'D'] as PlanSlotCode[];
  const exps = codes.map((c) => Math.exp(values[c]));
  const sum = exps.reduce((a, b) => a + b, 0);
  const out: Record<PlanSlotCode, number> = { B: 0, L: 0, D: 0 };
  codes.forEach((c, i) => {
    out[c] = sum > 0 ? exps[i]! / sum : 1 / 3;
  });
  return out;
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

function plannedGroupsAdjacent(
  mealPlan: MealPlanItem[],
  isoDate: string,
  group: RecipeCategoryGroup,
): boolean {
  const dayBefore = addLocalDays(isoDate, -1);
  const dayAfter = addLocalDays(isoDate, 1);
  for (const item of mealPlan) {
    if (item.made || !item.scheduledOn || !item.mealSlot) continue;
    if (item.scheduledOn !== dayBefore && item.scheduledOn !== dayAfter) continue;
    const itemGroup = recipeCategoryGroup({ category: '', title: item.title, tags: [] });
    if (itemGroup === group) return true;
  }
  return false;
}

function priorShare(group: RecipeCategoryGroup, now: Date): Record<PlanSlotCode, number> {
  const bonus = timeOfDayBonus(now);
  const prior = SLOT_PRIOR[group];
  const timeWeight = group === 'unknown' ? 1 : 0.35;
  const points: Record<PlanSlotCode, number> = {
    B: prior.B + bonus.B * timeWeight,
    L: prior.L + bonus.L * timeWeight,
    D: prior.D + bonus.D * timeWeight,
  };
  return softmax(points);
}

function learnedShare(
  index: EngagementIndexV2,
  group: RecipeCategoryGroup,
): { shares: Record<PlanSlotCode, number>; total: number } {
  const row = index.ghostSlot[group] ?? {};
  const counts: Record<PlanSlotCode, number> = {
    B: row.B ?? 0,
    L: row.L ?? 0,
    D: row.D ?? 0,
  };
  const total = counts.B + counts.L + counts.D;
  const shares: Record<PlanSlotCode, number> = {
    B: (counts.B + 1) / (total + 3),
    L: (counts.L + 1) / (total + 3),
    D: (counts.D + 1) / (total + 3),
  };
  return { shares, total };
}

function slotProbabilities(
  index: EngagementIndexV2,
  group: RecipeCategoryGroup,
  now: Date,
): Record<PlanSlotCode, number> {
  const prior = priorShare(group, now);
  const { shares, total } = learnedShare(index, group);
  const lambda = total / (total + 5);
  return {
    B: (1 - lambda) * prior.B + lambda * shares.B,
    L: (1 - lambda) * prior.L + lambda * shares.L,
    D: (1 - lambda) * prior.D + lambda * shares.D,
  };
}

function dayScore(
  index: EngagementIndexV2,
  slot: PlanSlotCode,
  isoDate: string,
  todayIso: string,
  group: RecipeCategoryGroup,
  mealPlan: MealPlanItem[],
): number {
  const weekday = (() => {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d).getDay();
  })();
  const row = index.ghostWeekday[slot] ?? {};
  const wTotal = Object.values(row).reduce((a, b) => a + b, 0);
  const wDay = row[String(weekday)] ?? 0;
  const daysAhead = Math.max(
    0,
    Math.round(
      (Date.parse(`${isoDate}T12:00:00`) - Date.parse(`${todayIso}T12:00:00`)) / (24 * 60 * 60 * 1000),
    ),
  );
  const habit = Math.log((wDay + 1) / (wTotal / 7 + 1));
  const soonness = 0.2 * daysAhead;
  const adjacent = plannedGroupsAdjacent(mealPlan, isoDate, group) ? 0.5 : 0;
  return habit - soonness - adjacent;
}

function openPairs(
  input: GhostGuesserInput,
  group: RecipeCategoryGroup,
  todayIso: string,
  now: Date,
): { day: string; slot: MealSlot; slotCode: PlanSlotCode }[] {
  const pairs: { day: string; slot: MealSlot; slotCode: PlanSlotCode }[] = [];
  for (let offset = 0; offset < MEAL_CALENDAR.daysAhead; offset += 1) {
    const day = addLocalDays(todayIso, offset);
    const used = occupiedSlots(input.mealPlan, day);
    for (const code of ['B', 'L', 'D'] as PlanSlotCode[]) {
      const slot = planCodeToMealSlot(code);
      if (used.has(slot)) continue;
      if (slotCutoffPassed(slot, day, now)) continue;
      pairs.push({ day, slot, slotCode: code });
    }
  }
  return pairs;
}

export function guessGhostDaySlot(input: GhostGuesserInput): GhostGuesserResult {
  const todayIso = input.todayIso ?? localDateString(input.now);
  const now = input.now ?? new Date();
  const group = recipeCategoryGroup({
    category: input.category,
    title: input.title,
    tags: input.tags,
  });
  const slotProbs = slotProbabilities(input.index, group, now);
  const pairs = openPairs(input, group, todayIso, now);

  let bestDay = addLocalDays(todayIso, MEAL_CALENDAR.daysAhead - 1);
  let bestSlot: MealSlot = 'dinner';
  let bestCode: PlanSlotCode = 'D';
  let bestScore = -Infinity;
  let bestSlotProb = 0;

  for (const pair of pairs) {
    const sp = slotProbs[pair.slotCode];
    const ds = dayScore(input.index, pair.slotCode, pair.day, todayIso, group, input.mealPlan);
    const score = Math.log(Math.max(sp, 1e-6)) + ds;
    if (score > bestScore) {
      bestScore = score;
      bestDay = pair.day;
      bestSlot = pair.slot;
      bestCode = pair.slotCode;
      bestSlotProb = sp;
    }
  }

  const showSlotGhost = bestSlotProb >= 0.4;
  const compactPrompt = Boolean(input.index.compactPromptOn[group]);

  return {
    day: bestDay,
    slot: bestSlot,
    slotCode: bestCode,
    group,
    slotProb: bestSlotProb,
    showSlotGhost,
    compactPrompt,
  };
}
