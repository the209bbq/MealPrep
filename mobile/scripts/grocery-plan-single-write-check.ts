/**
 * Planning a meal should not stack grocery lines before debounced rebuild.
 * Run from mobile/: npm run test:grocery-plan-single-write
 */

import assert from 'node:assert/strict';
import { buildGroceryList } from '../lib/grocery';
import type { GroceryListItem, MealPlanItem, PantryItem, Recipe } from '../types/mealprep';

const recipe: Recipe = {
  id: 'butter-chicken',
  name: 'Butter Chicken',
  tag: '',
  description: '',
  servings: 4,
  minutes: 40,
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  ingredients: [
    { name: 'chicken thighs', ingredientId: 'chicken-thighs', quantity: 1.5, unit: 'lb' },
    { name: 'heavy cream', ingredientId: 'cream', quantity: 1, unit: 'cup' },
  ],
  steps: [],
  isMaster: false,
  createdAt: '',
};

const meal: MealPlanItem = {
  id: 'meal-1',
  recipeSlug: recipe.id,
  recipeApiId: null,
  title: 'Butter Chicken',
  imageUrl: null,
  made: false,
  madeAt: null,
  addedAt: new Date().toISOString(),
  scheduledOn: '2026-10-12',
  mealSlot: 'dinner',
  leftoverOfId: null,
  linkedLeftoverId: null,
};

const pantry: PantryItem[] = [];
const owner = 'plan-single-write-user';
const rebuilt = buildGroceryList([recipe], [recipe.id], pantry, {}, [], {
  mealPlan: [meal],
  userId: owner,
});

const thighs = rebuilt.find((row) => row.name.toLowerCase().includes('chicken'));
const cream = rebuilt.find((row) => row.name.toLowerCase().includes('cream'));
assert.equal(thighs?.quantity, 1.5, 'chicken thighs should not double on meal-plan rebuild');
assert.equal(cream?.quantity, 1, 'cream should not double on meal-plan rebuild');

const duplicateManual: GroceryListItem[] = [
  {
    id: 'groc-chicken-thighs::lb',
    ingredientId: 'chicken-thighs',
    name: 'chicken thighs',
    category: 'meats',
    quantity: 1.5,
    unit: 'lb',
    checked: false,
    sourceRecipeIds: [recipe.id],
    origin: 'add_missing',
    plannedMealLinks: [],
  },
];
const withStaleAppend = buildGroceryList([recipe], [recipe.id], pantry, {}, duplicateManual, {
  mealPlan: [meal],
  userId: owner,
});
const thighsAfter = withStaleAppend.find((row) => row.name.toLowerCase().includes('chicken'));
assert.equal(thighsAfter?.quantity, 1.5, 'rebuild should replace stale append-missing line');

console.log('grocery-plan-single-write-check: ok');
