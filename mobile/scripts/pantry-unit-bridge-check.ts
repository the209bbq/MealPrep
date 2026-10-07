/**
 * Pantry unit bridges for cook + restock flows.
 * Run from mobile/: npm run test:pantry-unit-bridge
 */

import assert from 'node:assert/strict';
import { mergePantryQuantities } from '../lib/pantry/mergePantryStock';
import {
  buildPantryDeductionLines,
  applyPantryDeductions,
} from '../lib/mealPlan/pantryDeduction';
import { isIngredientUnmeasurableForDeduction } from '../lib/mealPlan/deductionIngredient';
import { planStapleRestockLines } from '../lib/forkinator/restockReminders';
import { findPantryItemsForIngredient } from '../lib/recipeMatch/pantryStock';
import { scoreRecipeForPantryDeduction } from '../lib/recipeMatch/match';
import { ingredientShortfall } from '../lib/recipeMatch/pantryStock';
import type { PantryItem, Recipe } from '../types/mealprep';

function pantryRow(name: string, quantity: number, unit: string, id: string): PantryItem {
  return {
    id,
    ingredientId: id,
    name,
    category: 'produce',
    quantity,
    unit,
    location: 'pantry',
    photoUri: null,
    expiresOn: null,
    updatedAt: new Date().toISOString(),
  };
}

const chickenPantry = pantryRow('Chicken Thighs', 0.25, 'lb', 'chicken');
const chickenBuy = pantryRow('Chicken Thighs', 1.25, 'lb', 'chicken-new');
const mergedChicken = mergePantryQuantities(chickenPantry, chickenBuy);
assert.equal(mergedChicken.quantity, 1.5, 'restock should add lb quantities');

const ricePantry = pantryRow('Rice', 5, 'lb', 'rice');
const riceNeed = { name: 'Jasmine Rice', ingredientId: 'jasmine-rice', quantity: 4, unit: 'cup' };
assert.equal(ingredientShortfall(riceNeed, [ricePantry], 4), null, '5 lb rice covers 4 cups jasmine');

const eggRecipe: Recipe = {
  id: 'eggs',
  name: 'Eggs',
  tag: '',
  description: '',
  servings: 1,
  minutes: 1,
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  ingredients: [{ name: 'Eggs', ingredientId: 'eggs', quantity: 3, unit: 'Large' }],
  steps: [],
  isMaster: false,
  createdAt: '',
};
const eggPantry = [pantryRow('Eggs', 12, 'each', 'eggs')];
const eggMatch = scoreRecipeForPantryDeduction(eggRecipe, eggPantry);
const eggLines = buildPantryDeductionLines(eggMatch, eggRecipe, {}, new Set());
const eggAfter = applyPantryDeductions(eggPantry, eggLines).nextPantry[0];
assert.equal(eggAfter?.quantity, 9, '3 large eggs deduct from dozen each');

const stapleEggPantry: PantryItem[] = [
  {
    id: 'staple-eggs-row',
    ingredientId: 'staple-eggs',
    name: 'Eggs',
    category: 'dairy',
    quantity: 12,
    unit: 'each',
    location: 'fridge',
    photoUri: null,
    expiresOn: null,
    updatedAt: new Date().toISOString(),
  },
];
const twoEggRecipe: Recipe = {
  ...eggRecipe,
  id: 'two-eggs',
  ingredients: [{ name: 'Eggs', ingredientId: 'eggs', quantity: 2, unit: 'each' }],
};
const stapleEggMatch = scoreRecipeForPantryDeduction(twoEggRecipe, stapleEggPantry);
const stapleEggLines = buildPantryDeductionLines(stapleEggMatch, twoEggRecipe, {}, new Set());
const stapleEggAfter = applyPantryDeductions(stapleEggPantry, stapleEggLines).nextPantry[0];
assert.equal(stapleEggAfter?.quantity, 10, 'catalog staple eggs 12 minus 2 each');

const milkPantry: PantryItem[] = [
  {
    id: 'staple-milk-row',
    ingredientId: 'staple-milk',
    name: 'Milk',
    category: 'dairy',
    quantity: 1,
    unit: 'gal',
    location: 'fridge',
    photoUri: null,
    expiresOn: null,
    updatedAt: new Date().toISOString(),
  },
];
const milkRecipe: Recipe = {
  ...eggRecipe,
  id: 'milk-cup',
  ingredients: [{ name: 'Milk', ingredientId: 'milk', quantity: 1, unit: 'cup' }],
};
const milkMatch = scoreRecipeForPantryDeduction(milkRecipe, milkPantry);
const milkLines = buildPantryDeductionLines(milkMatch, milkRecipe, {}, new Set());
const milkAfter = applyPantryDeductions(milkPantry, milkLines).nextPantry[0];
assert.equal(milkAfter?.quantity, 0.94, '1 gal milk minus 1 cup (rounded)');

assert.equal(
  isIngredientUnmeasurableForDeduction({
    name: 'Salt',
    ingredientId: 'salt',
    quantity: 1,
    unit: 'to taste',
  }),
  true,
  'salt to taste is not deducted',
);
const saltRecipe: Recipe = {
  ...eggRecipe,
  id: 'salt-recipe',
  ingredients: [
    { name: 'Salt', ingredientId: 'salt', quantity: 1, unit: 'to taste' },
    { name: 'Eggs', ingredientId: 'eggs', quantity: 2, unit: 'each' },
  ],
};
const saltMatch = scoreRecipeForPantryDeduction(saltRecipe, stapleEggPantry);
assert.equal(saltMatch.matched.length, 1, 'only measurable eggs match for deduction');
const skipId = stapleEggPantry[0].id;
const skippedLines = buildPantryDeductionLines(saltMatch, saltRecipe, {}, new Set([skipId]));
assert.equal(skippedLines.length, 0, 'unchecked review row does not deduct');

const lowEggPantry: PantryItem[] = [{ ...stapleEggPantry[0], quantity: 1 }];
const restock = planStapleRestockLines(lowEggPantry, []);
assert.equal(restock.length, 1, 'staple at 25% or below triggers restock plan');
assert.equal(restock[0]?.stapleId, 'eggs');

const yolkMatches = findPantryItemsForIngredient(
  { name: 'Egg yolk', ingredientId: 'egg-yolk', quantity: 1, unit: 'each' },
  stapleEggPantry,
);
assert.equal(yolkMatches.length, 1, 'egg yolk maps to eggs staple pantry row');

console.log('pantry-unit-bridge-check: ok');
