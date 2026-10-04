/**
 * Cost-per-serving calculator regression.
 * Run from mobile/: npm run test:cost-per-serving
 */

import { calculateRecipeCostPerServing, formatUsd } from '../lib/costPerServing';
import { sampleRecipeAmountForEntry } from '../lib/costPerServing/basePriceAuditSample';
import { BASE_PRICE_TABLE } from '../lib/costPerServing/basePrices';
import { proratedPackageCost } from '../lib/costPerServing/amountToPackage';
import { normalizeIngredientAmount } from '../lib/costPerServing/parseIngredientAmount';
import type { Recipe } from '../types/mealprep';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const ctx = { ownerId: 'demo-user', communityDeals: [] as const };

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

const estimate = calculateRecipeCostPerServing(sampleRecipe, ctx);

assert(estimate.pricedCount >= 3, 'should price pasta, oil, and garlic');
assert(estimate.unpricedCount >= 1, 'salt or water should be unpriced/skipped');
assert(estimate.costPerServing != null && estimate.costPerServing > 0, 'cost per serving should be positive');
assert(formatUsd(estimate.costPerServing!) === `$${estimate.costPerServing!.toFixed(2)}`, 'formatUsd uses decimals');

const unitFixtures: Array<{ name: string; quantity: number; unit: string }> = [
  { name: 'onion', quantity: 1, unit: '' },
  { name: 'broccoli', quantity: 2, unit: 'cup' },
  { name: 'soy sauce', quantity: 3, unit: 'tbsp' },
];

for (const row of unitFixtures) {
  const one = calculateRecipeCostPerServing(
    {
      servings: 4,
      ingredients: [{ ingredientId: 'x', name: row.name, quantity: row.quantity, unit: row.unit }],
    },
    ctx,
  );
  assert(one.pricedCount === 1, `${row.name} should price with qty/unit ${row.quantity}/${row.unit}`);
}

const mealDbMeasures: Array<{ quantity: number; unit: string; expectUnit: string }> = [
  { quantity: 0, unit: '1 large', expectUnit: 'each' },
  { quantity: 0, unit: '1/2 tsp', expectUnit: 'tsp' },
  { quantity: 0, unit: '200g', expectUnit: 'g' },
  { quantity: 1, unit: 'can', expectUnit: 'can' },
  { quantity: 2, unit: 'chopped', expectUnit: 'cup' },
];

for (const row of mealDbMeasures) {
  const norm = normalizeIngredientAmount(row.quantity, row.unit);
  assert(norm.unit === row.expectUnit, `normalize ${row.unit} -> ${norm.unit}, expected ${row.expectUnit}`);
}

const largeOnion = calculateRecipeCostPerServing(
  {
    servings: 4,
    ingredients: [{ ingredientId: 'o', name: 'onion', quantity: 1, unit: 'large' }],
  },
  ctx,
);
assert(largeOnion.pricedCount === 1, 'large onion should price');

for (const row of [
  { name: 'eggs', quantity: 2, unit: '' },
  { name: 'eggs', quantity: 2, unit: 'large' },
  { name: 'large eggs', quantity: 2, unit: '' },
]) {
  const eggs = calculateRecipeCostPerServing(
    {
      servings: 4,
      ingredients: [{ ingredientId: 'e', name: row.name, quantity: row.quantity, unit: row.unit }],
    },
    ctx,
  );
  assert(eggs.pricedCount === 1, `should price ${row.name} (${row.quantity} ${row.unit})`);
}

const auditFailures: string[] = [];
for (const entry of BASE_PRICE_TABLE) {
  const sample = sampleRecipeAmountForEntry(entry);
  const cost = proratedPackageCost({
    quantity: sample.quantity,
    unit: sample.unit,
    packageAmount: entry.packageAmount,
    packageUnit: entry.packageUnit,
    packagePrice: entry.packagePrice,
    baseEntry: entry,
  });
  if (cost == null || cost <= 0) {
    auditFailures.push(`${entry.id} (${sample.quantity} ${sample.unit})`);
  }
}
assert(auditFailures.length === 0, `base price audit failed: ${auditFailures.join(', ')}`);

const chickenBowl = calculateRecipeCostPerServing(
  {
    servings: 4,
    ingredients: [
      { ingredientId: '1', name: 'chicken breast', quantity: 1, unit: 'lb' },
      { ingredientId: '2', name: 'rice', quantity: 1, unit: 'cup' },
      { ingredientId: '3', name: 'broccoli', quantity: 2, unit: 'cup' },
      { ingredientId: '4', name: 'onion', quantity: 1, unit: '' },
      { ingredientId: '5', name: 'garlic', quantity: 3, unit: 'clove' },
      { ingredientId: '6', name: 'soy sauce', quantity: 2, unit: 'tbsp' },
      { ingredientId: '7', name: 'olive oil', quantity: 1, unit: 'tbsp' },
      { ingredientId: '8', name: 'bell pepper', quantity: 1, unit: 'medium' },
      { ingredientId: '9', name: 'carrot', quantity: 2, unit: 'each' },
    ],
  },
  ctx,
);

assert(
  chickenBowl.pricedCount >= 7,
  `typical 9-ingredient dinner should price at least 7; got ${chickenBowl.pricedCount}`,
);

const noServings = calculateRecipeCostPerServing({ ...sampleRecipe, servings: 0 }, ctx);
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
