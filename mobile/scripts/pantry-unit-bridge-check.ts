/**
 * Pantry unit bridges for cook + restock flows.
 * Run from mobile/: npm run test:pantry-unit-bridge
 */

import assert from 'node:assert/strict';
import { mergePantryQuantities } from '../lib/pantry/mergePantryStock';
import { buildPantryDeductionLines, applyPantryDeductions } from '../lib/mealPlan/pantryDeduction';
import { scoreRecipeAgainstPantry } from '../lib/recipeMatch/match';
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
const eggMatch = scoreRecipeAgainstPantry(eggRecipe, eggPantry);
const eggLines = buildPantryDeductionLines(eggMatch, eggRecipe, {}, new Set());
const eggAfter = applyPantryDeductions(eggPantry, eggLines).nextPantry[0];
assert.equal(eggAfter?.quantity, 9, '3 large eggs deduct from dozen each');

console.log('pantry-unit-bridge-check: ok');
