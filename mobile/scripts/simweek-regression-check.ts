/**
 * Sim-week regression: grocery rebuild idempotency, MealDB meal plan, manual rows, pantry restock.
 * Run: npm run test:simweek-regression
 */

import assert from 'node:assert/strict';
import { buildGroceryList, createManualGroceryItem } from '../lib/grocery';
import { rememberPlannedMealDbRecipe, resetPlannedMealDbRecipeStoreForTests } from '../lib/mealdb/plannedRecipeStore';
import { resolveMealPlanRecipeId } from '../lib/mealPlan/resolve';
import { kitchenRecipesWithMealPlanContext } from '../lib/recipeMatch/kitchenCatalogMerge';
import { scoreRecipeAgainstPantry } from '../lib/recipeMatch/match';
import { mergeGroceryWithMissing } from '../lib/recipeMatch/groceryFromMissing';
import { mergePantryStock, groceryItemsToPantryItems } from '../lib/pantry/mergePantryStock';
import type { GroceryListItem, MealPlanItem, PantryItem, Recipe } from '../types/mealprep';

function mealPlanRow(id: string, recipeSlug: string, title: string): MealPlanItem {
  return {
    id,
    recipeSlug,
    recipeApiId: null,
    title,
    imageUrl: null,
    made: false,
    madeAt: null,
    addedAt: new Date().toISOString(),
    scheduledOn: '2026-10-07',
    mealSlot: 'dinner',
    leftoverOfId: null,
    linkedLeftoverId: null,
  };
}

const mealDbRecipe: Recipe = {
  id: 'mealdb-53367',
  name: 'Chicken Fried Rice',
  tag: 'Classic',
  description: '',
  servings: 4,
  minutes: 25,
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  ingredients: [
    { name: 'Chicken', ingredientId: 'chicken', quantity: 1, unit: 'lb' },
    { name: 'Rice', ingredientId: 'rice', quantity: 2, unit: 'cup' },
  ],
  steps: ['Cook'],
  isMaster: false,
  createdAt: '',
  sourceType: 'themealdb',
};

const butterChicken: Recipe = {
  id: 'imported-butter',
  name: 'Butter Chicken',
  tag: '',
  description: '',
  servings: 4,
  minutes: 30,
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  ingredients: [{ name: 'Chicken thighs', ingredientId: 'chicken-thighs', quantity: 1.5, unit: 'lb' }],
  steps: [],
  isMaster: false,
  createdAt: '',
};

resetPlannedMealDbRecipeStoreForTests();
rememberPlannedMealDbRecipe(mealDbRecipe);

const mealPlan = [mealPlanRow('plan-mealdb', 'mealdb-53367', 'Chicken Fried Rice')];
const pantry: PantryItem[] = [];
const kitchen = kitchenRecipesWithMealPlanContext([], [], pantry, mealPlan);
assert.ok(kitchen.some((r) => r.id === 'mealdb-53367'), 'planned MealDB recipe resolves for grocery');
const resolvedId = resolveMealPlanRecipeId(mealPlan[0], kitchen, 'user-1');
assert.equal(resolvedId, 'mealdb-53367', 'meal plan slug resolves to MealDB kitchen id');
const cookRecipe = kitchen.find((r) => r.id === resolvedId);
assert.ok(cookRecipe && scoreRecipeAgainstPantry(cookRecipe, pantry).missing.length > 0, 'MealDB cook/pantry path has ingredients');

let groceryState: GroceryListItem[] = [];
for (let i = 0; i < 5; i += 1) {
  groceryState = buildGroceryList(kitchen, ['mealdb-53367'], pantry, {}, groceryState, {
    mealPlan,
    userId: 'user-1',
  });
}
const chickenLine = groceryState.find((row) => row.name === 'Chicken');
assert.equal(chickenLine?.quantity, 1, 'MealDB grocery rebuild is idempotent (5x)');

const planMeal = mealPlanRow('plan-bc', 'imported-butter', 'Butter Chicken');
const withMissing = mergeGroceryWithMissing(
  [],
  [{ name: 'Chicken thighs', ingredientId: 'chicken-thighs', quantity: 1.5, unit: 'lb' }],
  butterChicken.id,
  pantry,
);
let snowball = withMissing.items;
for (let i = 0; i < 5; i += 1) {
  snowball = buildGroceryList([butterChicken], [], pantry, {}, snowball, {
    mealPlan: [planMeal],
    userId: 'user-1',
  });
}
const thigh = snowball.find((row) => row.name === 'Chicken thighs');
assert.equal(thigh?.quantity, 1.5, 'plan rebuild does not stack add_missing rows (5x)');

const manual = createManualGroceryItem({ name: 'Bananas', quantity: 6, unit: 'each', category: 'produce' });
const afterManual = buildGroceryList(kitchen, ['mealdb-53367'], pantry, {}, [...groceryState, manual], {
  mealPlan,
  userId: 'user-1',
});
assert.ok(afterManual.some((row) => row.name === 'Bananas' && row.origin === 'manual'), 'manual grocery survives meal-plan rebuild');

const pantryBefore: PantryItem[] = [];
const optimistic = mergePantryStock(pantryBefore, groceryItemsToPantryItems([manual])).pantry;
const saved = optimistic.map((row, index) => ({
  ...row,
  id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
}));
const reconciled = mergePantryStock(pantryBefore, saved).pantry;
assert.equal(reconciled.length, 1, 'pantry restock reconcile does not duplicate rows');

console.log('simweek-regression-check: ok');
