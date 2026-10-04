/**
 * Cost-per-serving calculator regression.
 * Run from mobile/: npm run test:cost-per-serving
 */

import { calculateRecipeCostPerServing, formatUsd } from '../lib/costPerServing';
import type { Recipe } from '../types/mealprep';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const sampleRecipe: Recipe = {
  id: 'test-recipe',
  name: 'Simple pasta',
  tag: 'test',
  description: '',
  servings: 4,
  minutes: 20,
  calories: 400,
  protein: 12,
  carbs: 60,
  fat: 10,
  ingredients: [
    { ingredientId: '1', name: 'spaghetti', quantity: 8, unit: 'oz' },
    { ingredientId: '2', name: 'olive oil', quantity: 2, unit: 'tbsp' },
    { ingredientId: '3', name: 'garlic', quantity: 2, unit: 'clove' },
    { ingredientId: '4', name: 'salt', quantity: 0, unit: '' },
    { ingredientId: '5', name: 'water', quantity: 4, unit: 'cup' },
  ],
  steps: [],
  isMaster: false,
  createdAt: '',
};

const estimate = calculateRecipeCostPerServing(sampleRecipe, {
  ownerId: 'demo-user',
  communityDeals: [],
});

assert(estimate.pricedCount >= 3, 'should price pasta, oil, and garlic');
assert(estimate.unpricedCount >= 1, 'salt or water should be unpriced/skipped');
assert(estimate.costPerServing != null && estimate.costPerServing > 0, 'cost per serving should be positive');
assert(formatUsd(estimate.costPerServing!) === `$${estimate.costPerServing!.toFixed(2)}`, 'formatUsd uses decimals');

const noServings = calculateRecipeCostPerServing(
  { ...sampleRecipe, servings: 0 },
  { ownerId: 'demo-user', communityDeals: [] },
);
assert(noServings.servingsAssumedDefault, 'missing servings should default to 4');
assert(noServings.servings === 4, 'default servings is 4');

const withDeal = calculateRecipeCostPerServing(
  {
    servings: 2,
    ingredients: [{ ingredientId: 'm', name: 'milk', quantity: 1, unit: 'cup' }],
  },
  {
    ownerId: 'user-1',
    communityDeals: [
      {
        id: 'd1',
        storeKey: 'kroger',
        itemName: 'whole milk',
        price: 3.79,
        unit: '1 gal',
        reportedBy: 'user-1',
        createdAt: new Date().toISOString(),
        confirmCount: 0,
        expiredCount: 0,
      },
    ],
  },
);

assert(withDeal.pricedCount === 1, 'community deal should price milk');
assert(withDeal.lines[0]?.source === 'memory', 'own community price counts as memory');
assert(withDeal.costPerServing != null && withDeal.costPerServing < 3.79, 'one cup of milk is less than a gallon');

console.log('cost-per-serving-check: ok');
