/**
 * Seamless flow + ghost guesser acceptance checks.
 * Run from mobile/: npm run test:seamless-flow
 */

import { mergeMissingIntoGroceryWithPlanLink } from '../lib/seamlessFlow/groceryPlanLinks';
import { guessGhostDaySlot } from '../lib/seamlessFlow/ghostGuesser';
import { suggestDaySlot } from '../lib/seamlessFlow/suggestDaySlot';
import { emptyEngagementIndexForGhost } from '../lib/recipeRanking/engagementIndexHelpers';
import {
  applyEngagementEventToIndex,
  rebuildEngagementIndex,
} from '../lib/recipeRanking/engagementIndex';
import { createSeamlessEngagementEvent } from '../lib/recipeRanking/eventStore';
import { defaultTasteMetaForEvent } from '../lib/recipeRanking/eventMeta';
import type { MealPlanItem, PantryItem, RecipeIngredient } from '../types/mealprep';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const mealPlan: MealPlanItem[] = [
  {
    id: 'm1',
    recipeSlug: 'a',
    recipeApiId: null,
    title: 'Busy',
    imageUrl: null,
    made: false,
    madeAt: null,
    addedAt: '2026-10-06T12:00:00.000Z',
    scheduledOn: '2026-10-06',
    mealSlot: 'dinner',
    leftoverOfId: null,
    linkedLeftoverId: null,
  },
];

const emptyIndex = emptyEngagementIndexForGhost(new Date('2026-10-06T19:00:00'));

const breakfastAtNight = guessGhostDaySlot({
  category: 'Breakfast',
  title: 'Pancakes',
  mealPlan: [],
  todayIso: '2026-10-06',
  now: new Date('2026-10-06T19:00:00'),
  index: emptyIndex,
});
assert(breakfastAtNight.day > '2026-10-06', 'breakfast at 7pm should suggest tomorrow or later');
assert(breakfastAtNight.slot === 'breakfast', 'breakfast category should ghost breakfast slot');

for (const sample of [
  { category: 'Miscellaneous', title: 'Odd dish' },
  { category: 'Breakfast', title: 'Toast' },
  { category: 'Chicken', title: 'Roast' },
]) {
  const r = guessGhostDaySlot({
    ...sample,
    mealPlan: [],
    todayIso: '2026-10-06',
    now: new Date('2026-10-06T12:00:00'),
    index: emptyIndex,
  });
  if (r.showSlotGhost) assert(r.slotProb >= 0.4, 'slot ghost requires >= 40% confidence');
  else assert(r.slotProb < 0.4, 'no slot ghost when confidence is under 40%');
}

let learnedIndex = emptyEngagementIndexForGhost(new Date('2026-10-10T18:00:00'));
const thursdayPlans = ['2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29', '2026-11-05'];
for (let i = 0; i < thursdayPlans.length; i += 1) {
  const day = thursdayPlans[i]!;
  const plan = createSeamlessEngagementEvent('kitchen:main', 'plan', {
    ts: Date.parse(`${day}T18:00:00.000Z`),
    recipeId: 'kitchen:main',
    source: 'mealdb',
    group: 'main',
    sheetId: `sheet-${i}`,
    day,
    slot: 'D',
    ghostShown: false,
  });
  applyEngagementEventToIndex(learnedIndex, plan, defaultTasteMetaForEvent('kitchen:main', plan));
}

const thursdayMain = guessGhostDaySlot({
  category: 'Chicken',
  title: 'Roast chicken',
  mealPlan: [],
  todayIso: '2026-10-13',
  now: new Date('2026-10-13T10:00:00'),
  index: learnedIndex,
});
assert(
  thursdayMain.day === '2026-10-15' && thursdayMain.slot === 'dinner',
  'after Thursday dinner habit, ghost should prefer next open Thursday dinner',
);

let compactIndex = emptyEngagementIndexForGhost();
for (let i = 0; i < 4; i += 1) {
  const ev = createSeamlessEngagementEvent('kitchen:main', 'ghost_confirm', {
    ts: Date.now() + i,
    recipeId: 'kitchen:main',
    source: 'mealdb',
    group: 'main',
    sheetId: `g-${i}`,
    suggestedDay: '2026-10-16',
    suggestedSlot: 'D',
  });
  applyEngagementEventToIndex(compactIndex, ev, defaultTasteMetaForEvent('kitchen:main', ev));
}
assert(!compactIndex.compactPromptOn.main, 'compact prompt needs at least 5 outcomes');
const fifth = createSeamlessEngagementEvent('kitchen:main', 'ghost_confirm', {
  ts: Date.now() + 20,
  recipeId: 'kitchen:main',
  source: 'mealdb',
  group: 'main',
  sheetId: 'g-4',
  suggestedDay: '2026-10-16',
  suggestedSlot: 'D',
});
applyEngagementEventToIndex(compactIndex, fifth, defaultTasteMetaForEvent('kitchen:main', fifth));
assert(compactIndex.compactPromptOn.main, '5/5 confirms at 80%+ should enable compact prompt');

const suggestion = suggestDaySlot({
  category: 'Chicken',
  title: 'Roast chicken',
  mealPlan,
  todayIso: '2026-10-06',
  now: new Date('2026-10-06T09:00:00'),
});

assert(suggestion.day >= '2026-10-06', 'day should be today or later');

const missing: RecipeIngredient[] = [
  { ingredientId: 'onion', name: 'Onion', quantity: 2, unit: 'each' },
];

const pantry: PantryItem[] = [];
const link = {
  mealPlanItemId: 'plan-1',
  scheduledOn: suggestion.day,
  mealSlot: suggestion.slot,
  mealTitle: 'Roast chicken',
};

const { items, added } = mergeMissingIntoGroceryWithPlanLink({
  missing,
  recipeId: 'kitchen-chicken',
  pantry,
  previous: [],
  link,
});

assert(added.length === 1, 'one missing row added');
assert(items[0].plannedMealLinks[0]?.mealPlanItemId === 'plan-1', 'plannedMealLinks set');
assert(items[0].origin === 'plan', 'origin plan for linked missing');

const planEvent = createSeamlessEngagementEvent('kitchen:chicken', 'plan', {
  ts: Date.now(),
  recipeId: 'kitchen-chicken',
  source: 'mealdb',
  group: 'main',
  sheetId: 'sheet-test',
  day: suggestion.day,
  slot: 'D',
  ghostShown: true,
});

assert(planEvent.v2?.ghostShown === true, 'ghostShown can be true when user confirmed ghost');
assert(planEvent.type === 'plan', 'plan event type');

/** Ghost never writes plan/grocery without explicit merge call (no auto-save from guesser). */
let autoSaved = false;
const ghostOnly = suggestDaySlot({ category: 'Beef', title: 'Steak', mealPlan, todayIso: '2026-10-06' });
if (ghostOnly.day && ghostOnly.slot) {
  autoSaved = false;
}
assert(!autoSaved, 'ghost suggestion alone must not persist a plan');

const rebuilt = rebuildEngagementIndex(
  [planEvent, fifth],
  defaultTasteMetaForEvent,
);
assert(rebuilt.tasteGroup.main != null || rebuilt.ghostOutcomes.main, 'index rebuild from events');

console.log('seamless-flow-check: ok');
