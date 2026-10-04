import assert from 'node:assert/strict';
import type { Recipe } from '../types/mealprep';
import { calculateRecipeCostPerServing } from '../lib/costPerServing/calculate';
import { fractionOfPackageUsed, proratedPackageCost } from '../lib/costPerServing/prorate';
import { isUnpriceableIngredient } from '../lib/costPerServing/skip';
import { resolvedIngredientAmount } from '../lib/costPerServing/parseIngredientAmount';

assert.equal(isUnpriceableIngredient('salt to taste', 0, ''), true);
assert.equal(isUnpriceableIngredient('water', 1, 'cup'), true);
assert.equal(isUnpriceableIngredient('chicken breast', 1, 'lb'), false);

const halfCupFlour = proratedPackageCost(0.5, 'cup', { amount: 5, unit: 'lb' }, 3.49, 'flour');
assert.ok(halfCupFlour !== null && halfCupFlour > 0 && halfCupFlour < 3.49);

const twoEggs = proratedPackageCost(2, 'each', { amount: 12, unit: 'each' }, 3.29);
assert.ok(twoEggs !== null);
assert.equal(Math.round((twoEggs ?? 0) * 100), Math.round((3.29 * (2 / 12)) * 100));

const frac = fractionOfPackageUsed(8, 'oz', { amount: 16, unit: 'oz' });
assert.equal(frac, 0.5);

const parsed = resolvedIngredientAmount({
  ingredientId: '1',
  name: '2 cups flour',
  quantity: 0,
  unit: '',
});
assert.equal(parsed.quantity, 2);
assert.equal(parsed.unit, 'cups');

function stubRecipe(ingredients: Recipe['ingredients'], servings = 4): Recipe {
  return {
    id: 'r1',
    name: 'Test',
    tag: '',
    description: '',
    servings,
    minutes: 20,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    ingredients,
    steps: [],
    isMaster: false,
    createdAt: '',
  };
}

const simple = calculateRecipeCostPerServing(
  stubRecipe([
    { ingredientId: 'a', name: 'chicken breast', quantity: 1, unit: 'lb' },
    { ingredientId: 'b', name: 'salt to taste', quantity: 0, unit: '' },
  ]),
  { ownerId: 'u1' },
);
assert.equal(simple.pricedCount, 1);
assert.equal(simple.skippedCount, 1);
assert.ok(simple.costPerServing !== null && simple.costPerServing > 0);

const divided = calculateRecipeCostPerServing(
  stubRecipe([{ ingredientId: 'a', name: 'eggs', quantity: 4, unit: 'each' }], 2),
  { ownerId: 'u1' },
);
assert.equal(divided.servings, 2);
assert.ok(divided.costPerServing !== null);
assert.ok(divided.totalCost > divided.costPerServing);

const defaultServings = calculateRecipeCostPerServing(
  stubRecipe([{ ingredientId: 'a', name: 'rice', quantity: 1, unit: 'cup' }], 0),
  { ownerId: 'u1' },
);
assert.equal(defaultServings.usedDefaultServings, true);
assert.equal(defaultServings.servings, 4);

console.log('cost-per-serving-check: ok');
