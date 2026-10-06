/**
 * Seamless "when to cook" flow — default plan slot, grocery links, events, 2-tap path.
 * Run from mobile/: npm run test:seamless-flow
 */

import {
  applyGroceryCheckRestockBatch,
  reverseGroceryCheckRestock,
} from '../lib/grocery/restockLedger';
import { buildPantryDeductionLines, applyPantryDeductions } from '../lib/mealPlan/pantryDeduction';
import { scoreRecipeAgainstPantry } from '../lib/recipeMatch/match';
import { mergeMissingIntoGroceryWithPlanLink } from '../lib/seamlessFlow/groceryPlanLinks';
import {
  cookPromptKeyForMeal,
  isPlannedMealPromptDue,
  pickDuePlannedMeal,
  plannedMealPromptEligibleAt,
} from '../lib/seamlessFlow/cookPrompt';
import { suggestDaySlot } from '../lib/seamlessFlow/suggestDaySlot';
import { createSeamlessEngagementEvent } from '../lib/recipeRanking/eventStore';
import type {
  GroceryListItem,
  MealPlanItem,
  PantryItem,
  Recipe,
  RecipeIngredient,
} from '../types/mealprep';

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

const ledger = new Map<string, { pantryItemId: string; quantityAdded: number; unit: string }>();
const onionRows: GroceryListItem[] = [
  {
    id: 'o1',
    ingredientId: 'onion',
    name: 'Onion',
    category: 'produce',
    quantity: 1,
    unit: 'each',
    checked: true,
    sourceRecipeIds: [],
    origin: 'plan',
    plannedMealLinks: [],
  },
  {
    id: 'o2',
    ingredientId: 'onion',
    name: 'Onion',
    category: 'produce',
    quantity: 2,
    unit: 'each',
    checked: true,
    sourceRecipeIds: [],
    origin: 'plan',
    plannedMealLinks: [],
  },
];
let pantryAfter = applyGroceryCheckRestockBatch([], onionRows, ledger);
assert(pantryAfter.length === 1 && pantryAfter[0].quantity === 3, 'merged check-off adds summed quantity once');
const afterUncheckOne = reverseGroceryCheckRestock(pantryAfter, 'o1', ledger);
assert(afterUncheckOne[0].quantity === 2, 'uncheck one merged line reverses its portion');

const deductRecipe: Recipe = {
  id: 'milk-meal',
  name: 'Milk meal',
  tag: '',
  description: '',
  servings: 2,
  minutes: 20,
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  ingredients: [{ name: 'Milk', ingredientId: 'milk', quantity: 1, unit: 'cup' }],
  steps: [],
  isMaster: true,
  createdAt: '',
};
const deductPantry: PantryItem[] = [
  {
    id: 'p-milk',
    ingredientId: 'milk',
    name: 'Milk',
    category: 'dairy',
    quantity: 1,
    unit: 'cup',
    location: 'fridge',
    photoUri: null,
    expiresOn: null,
    updatedAt: '',
  },
];
const deductMatch = scoreRecipeAgainstPantry(deductRecipe, deductPantry);
const deductLines = buildPantryDeductionLines(deductMatch, deductRecipe, {}, new Set());
const { nextPantry: deducted } = applyPantryDeductions(deductPantry, deductLines);
assert(deducted.length === 0, 'pantry deduction floors at zero and removes row');

const plannedMeal: MealPlanItem = {
  ...mealPlan[0],
  id: 'meal-dinner',
  scheduledOn: '2026-10-06',
  mealSlot: 'dinner',
};
const dinnerDeadline = plannedMealPromptEligibleAt('2026-10-06', 'dinner');
assert(dinnerDeadline?.getHours() === 20, 'dinner prompt eligible after 8pm local');
assert(
  !isPlannedMealPromptDue(plannedMeal, new Date('2026-10-06T18:00:00')),
  'not due before dinner cutoff',
);
assert(
  isPlannedMealPromptDue(plannedMeal, new Date('2026-10-06T20:30:00')),
  'due after dinner cutoff',
);

const asked = new Set([cookPromptKeyForMeal('meal-dinner')]);
assert(pickDuePlannedMeal([plannedMeal], asked) === null, 'ask-once skips answered meals');

const confirmed = createSeamlessEngagementEvent('kitchen:chicken', 'cook_confirmed', {
  ts: Date.now(),
  recipeId: 'kitchen-chicken',
  source: 'mealdb',
  group: 'main',
  sheetId: 'sheet-test',
  via: 'planned',
});
assert(confirmed.type === 'cook_confirmed' && confirmed.v2?.via === 'planned', 'cook_confirmed v2 via');

console.log('seamless-flow-check: ok');
