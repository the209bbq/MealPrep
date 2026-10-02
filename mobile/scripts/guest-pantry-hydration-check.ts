/**
 * Regression: guest kitchen storage must not be wiped before hydration reads storage.
 * Run from mobile/: npm run test:guest-pantry-hydration
 */

import {
  clearGuestKitchenStorage,
  readGuestMealPlan,
  readGuestPantry,
  readGuestRecipes,
  writeGuestMealPlan,
  writeGuestPantry,
  writeGuestRecipes,
} from '../lib/guest/localKitchenStore';
import type { MealPlanItem, PantryItem, Recipe } from '../types/mealprep';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function row(name: string, id: string): PantryItem {
  return {
    id,
    ingredientId: `ing-${id}`,
    name,
    category: 'produce',
    quantity: 1,
    unit: 'each',
    location: 'pantry',
    photoUri: null,
    expiresOn: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function simulateGuestPersistence(
  guestKitchenHydrated: boolean,
  pantry: PantryItem[],
  mealPlan: MealPlanItem[],
  recipes: Recipe[],
): void {
  if (!guestKitchenHydrated) return;
  writeGuestPantry(pantry);
  writeGuestMealPlan(mealPlan);
  writeGuestRecipes(recipes);
}

clearGuestKitchenStorage();
const saved = [row('Chicken breast', 'guest-chicken')];
writeGuestPantry(saved);
writeGuestMealPlan([
  {
    id: 'guest-plan-1',
    recipeSlug: 'pulled-pork',
    recipeApiId: null,
    title: 'Pulled Pork Bowl',
    imageUrl: null,
    made: false,
    madeAt: null,
    addedAt: '2026-01-01T00:00:00.000Z',
    scheduledOn: null,
    mealSlot: null,
    leftoverOfId: null,
    linkedLeftoverId: null,
  },
]);
writeGuestRecipes([]);

let guestKitchenHydrated = false;
let pantry: PantryItem[] = [];
let mealPlan: MealPlanItem[] = [];
let recipes: Recipe[] = [];

pantry = [];
mealPlan = [];
recipes = [];
simulateGuestPersistence(guestKitchenHydrated, pantry, mealPlan, recipes);
assert(readGuestPantry().length === 1, 'empty pre-hydration pantry must not overwrite stored guest pantry');
assert(readGuestMealPlan().length === 1, 'empty pre-hydration meal plan must not overwrite stored guest meal plan');

guestKitchenHydrated = true;
pantry = readGuestPantry();
mealPlan = readGuestMealPlan();
recipes = readGuestRecipes();
simulateGuestPersistence(guestKitchenHydrated, pantry, mealPlan, recipes);
assert(readGuestPantry().length === 1, 'hydrated guest pantry should persist after read');
assert(readGuestMealPlan().length === 1, 'hydrated guest meal plan should persist after read');

console.log('guest-pantry-hydration-check: ok');
