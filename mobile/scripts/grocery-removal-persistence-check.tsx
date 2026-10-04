/**
 * Grocery row removal + rebuild persistence (manual, add_missing, plan origins).
 * Run: npx tsx scripts/grocery-removal-persistence-check.tsx
 */

import assert from 'node:assert/strict';
import { buildGroceryList, createManualGroceryItem } from '../lib/grocery';
import {
  addGroceryDismissals,
  clearGroceryDismissals,
  groceryPinnedLineDismissalKey,
  readGroceryDismissals,
} from '../lib/grocery/dismissals';
import { groceryDismissalKeysForItem } from '../lib/grocery/removals';
import { mergeGroceryWithMissing } from '../lib/recipeMatch/groceryFromMissing';
import type { GroceryListItem, Recipe } from '../types/mealprep';

const owner = 'grocery-removal-persistence-check';

function simulateRemove(item: GroceryListItem, list: GroceryListItem[]): GroceryListItem[] {
  const keys = groceryDismissalKeysForItem(item);
  addGroceryDismissals(owner, keys);
  return list.filter((row) => row.id !== item.id);
}

const recipe: Recipe = {
  id: 'r-plan',
  name: 'Plan Recipe',
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

clearGroceryDismissals(owner);

// Plan-origin row stays off after rebuild when removed (recipe dismissal keys).
const planList = buildGroceryList([recipe], [recipe.id], [], {}, []);
assert.equal(planList.length, 1);
const afterPlanRemove = simulateRemove(planList[0], planList);
const planRebuild = buildGroceryList(
  [recipe],
  [recipe.id],
  [],
  {},
  afterPlanRemove,
  { groceryDismissals: readGroceryDismissals(owner) },
);
assert.equal(planRebuild.length, 0, 'removed plan item stays off after meal-plan rebuild');

// Manual row stays off when a stale previous list still contains it (pinned-line dismissal).
const manual = createManualGroceryItem({ name: 'Paper towels', quantity: 1, unit: 'each' });
const stalePrevious = [manual];
simulateRemove(manual, []);
const manualRebuild = buildGroceryList([], [], [], {}, stalePrevious, {
  groceryDismissals: readGroceryDismissals(owner),
});
assert.equal(manualRebuild.length, 0, 'removed manual item is not re-merged from stale previous');

// add_missing row stays off after rebuild with stale previous.
const missing = mergeGroceryWithMissing(
  [],
  [{ name: 'Basil', ingredientId: 'basil', quantity: 1, unit: 'bunch' }],
  recipe.id,
  [],
);
assert.equal(missing.items.length, 1);
const missingItem = missing.items[0];
simulateRemove(missingItem, missing.items);
const missingRebuild = buildGroceryList([], [], [], {}, [missingItem], {
  groceryDismissals: readGroceryDismissals(owner),
});
assert.equal(missingRebuild.length, 0, 'removed add_missing item is not re-merged from stale previous');

// New meal-plan need for same ingredient still appears (pinned dismissal does not block plan lines).
clearGroceryDismissals(owner);
addGroceryDismissals(owner, [groceryPinnedLineDismissalKey('Limes', 'each')]);
const planOnly = buildGroceryList([recipe], [recipe.id], [], {}, [], {
  groceryDismissals: readGroceryDismissals(owner),
});
assert.equal(planOnly.length, 1, 'pinned dismissal alone does not suppress new plan-derived rows');

clearGroceryDismissals(owner);
console.log('grocery-removal-persistence-check: ok');
