/**
 * Grocery remove + meal-plan rebuild persistence.
 * Run: npx tsx scripts/grocery-remove-persist-check.tsx
 */

import assert from 'node:assert/strict';
import { buildGroceryList, createManualGroceryItem } from '../lib/grocery';
import {
  addGroceryDismissals,
  clearGroceryDismissals,
  groceryManualLineDismissalKey,
  readGroceryDismissals,
} from '../lib/grocery/dismissals';
import { groceryDismissalKeysForItem } from '../lib/grocery/removals';
import type { GroceryListItem, Recipe } from '../types/mealprep';

const owner = 'grocery-remove-persist-test';
clearGroceryDismissals(owner);

const recipe: Recipe = {
  id: 'r-chicken',
  name: 'Chicken',
  tag: '',
  description: '',
  servings: 4,
  minutes: 20,
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  ingredients: [{ name: 'Limes', ingredientId: 'limes', quantity: 2, unit: 'each' }],
  steps: [],
  isMaster: false,
  createdAt: '',
};

const planRow: GroceryListItem = {
  id: 'groc-limes::each',
  ingredientId: 'limes',
  name: 'Limes',
  category: 'produce',
  quantity: 2,
  unit: 'each',
  checked: false,
  sourceRecipeIds: [],
  origin: 'plan',
};

const ctx = { plannedRecipeIds: [recipe.id], recipes: [recipe] };
const dismissalKeys = groceryDismissalKeysForItem(planRow, ctx);
assert.equal(dismissalKeys.length, 1, 'infers plan dismissal when sourceRecipeIds empty');
addGroceryDismissals(owner, dismissalKeys);

const afterRemoveRebuild = buildGroceryList(
  [recipe],
  [recipe.id],
  [],
  {},
  [],
  { groceryDismissals: readGroceryDismissals(owner) },
);
assert.equal(
  afterRemoveRebuild.some((row) => row.name === 'Limes'),
  false,
  'removed plan line stays off after rebuild',
);

const manual = createManualGroceryItem({ name: 'Tape', quantity: 1, unit: 'each' });
addGroceryDismissals(owner, [groceryManualLineDismissalKey(manual.name, manual.unit)]);
const manualRebuild = buildGroceryList([], [], [], {}, [manual], {
  groceryDismissals: readGroceryDismissals(owner),
});
assert.equal(manualRebuild.length, 0, 'dismissed manual pinned row does not return on rebuild');

clearGroceryDismissals(owner);
console.log('grocery-remove-persist-check: ok');
