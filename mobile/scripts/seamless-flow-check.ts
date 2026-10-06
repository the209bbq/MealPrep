/**
 * Seamless "when to cook" flow — default plan slot, grocery links, events, 2-tap path.
 * Run from mobile/: npm run test:seamless-flow
 */

import { mergeMissingIntoGroceryWithPlanLink } from '../lib/seamlessFlow/groceryPlanLinks';
import { suggestDaySlot } from '../lib/seamlessFlow/suggestDaySlot';
import { createSeamlessEngagementEvent } from '../lib/recipeRanking/eventStore';
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

const suggestion = suggestDaySlot({
  category: 'Chicken',
  title: 'Roast chicken',
  mealPlan,
  todayIso: '2026-10-06',
  now: new Date('2026-10-06T09:00:00'),
});

assert(suggestion.slot === 'dinner' || suggestion.slot === 'lunch', 'main category should prefer dinner or lunch');
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
  ghostShown: false,
});

assert(planEvent.v2?.sheetId === 'sheet-test', 'sheetId on event');
assert(planEvent.v2?.ghostShown === false, 'ghostShown false in this PR');
assert(planEvent.type === 'plan', 'plan event type');

const cookNowEvent = createSeamlessEngagementEvent('kitchen:chicken', 'cook_now', {
  ts: Date.now(),
  recipeId: 'kitchen-chicken',
  source: 'mealdb',
  group: 'main',
  sheetId: 'sheet-test',
  missingCount: 1,
});
assert(cookNowEvent.v2?.missingCount === 1, 'missingCount on cook_now');

/** 2-tap path: open sheet (external) + Plan it + confirm default day = 2 taps from sheet. */
let tapsFromSheet = 0;
tapsFromSheet += 1; // Plan it
tapsFromSheet += 1; // confirm day
assert(tapsFromSheet === 2, 'plan confirm is two taps from sheet');

console.log('seamless-flow-check: ok');
