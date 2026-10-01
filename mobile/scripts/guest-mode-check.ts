/**
 * Guest local kitchen store + sign-in merge checks.
 * Run from mobile/: npm run test:guest-mode
 */

import {
  clearGuestKitchenStorage,
  readGuestGrocery,
  readGuestMealPlan,
  readGuestPantry,
  writeGuestGrocery,
  writeGuestMealPlan,
  writeGuestPantry,
} from '../lib/guest/localKitchenStore';
import { mergeGuestKitchenIntoAccount } from '../lib/guest/mergeGuestKitchen';
import type { GroceryListItem, MealPlanItem, PantryItem } from '../types/mealprep';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function pantryRow(name: string, quantity: number, unit: string, id: string): PantryItem {
  return {
    id,
    ingredientId: `ing-${id}`,
    name,
    category: 'produce',
    quantity,
    unit,
    location: 'pantry',
    photoUri: null,
    expiresOn: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function mealPlanRow(recipeApiId: number, title: string, id: string): MealPlanItem {
  return {
    id,
    recipeSlug: null,
    recipeApiId,
    title,
    imageUrl: null,
    made: false,
    madeAt: null,
    addedAt: '2026-01-01T00:00:00.000Z',
  };
}

function groceryRow(name: string, quantity: number, unit: string, id: string): GroceryListItem {
  return {
    id,
    ingredientId: `manual-${name}`,
    name,
    category: 'produce',
    quantity,
    unit,
    checked: false,
    sourceRecipeIds: [],
  };
}

function main(): void {
  clearGuestKitchenStorage();
  const initialPantry = [pantryRow('Chicken breast', 1, 'lb', 'guest-chicken')];
  writeGuestPantry(initialPantry);
  writeGuestGrocery([groceryRow('Limes', 2, 'each', 'guest-limes')]);
  writeGuestMealPlan([mealPlanRow(42, 'Guest lemon chicken', 'guest-plan-1')]);

  assert(readGuestPantry().length === 1, 'guest pantry should persist one item');
  assert(readGuestGrocery().length === 1, 'guest grocery should persist one item');
  assert(readGuestMealPlan().length === 1, 'guest meal plan should persist one item');

  const accountPantry = [pantryRow('Chicken Breast', 2, 'lb', 'acct-chicken')];
  const accountGrocery = [groceryRow('Milk', 1, 'gal', 'acct-milk')];
  const guestPantry = readGuestPantry();
  const guestGrocery = readGuestGrocery();
  const guestMealPlan = readGuestMealPlan();
  const accountMealPlan = [mealPlanRow(99, 'Account turkey bowl', 'acct-plan')];

  const merged = mergeGuestKitchenIntoAccount(
    accountPantry,
    accountGrocery,
    guestPantry,
    guestGrocery,
    accountMealPlan,
    guestMealPlan,
  );

  assert(merged.pantry.length === 1, 'pantry merge should dedupe chicken by normalized name');
  assert(merged.pantry[0].quantity === 3, 'pantry merge should sum quantities for same unit');
  assert(merged.pantry[0].id === 'acct-chicken', 'pantry merge should keep account row id');
  assert(merged.pantryInserts.length === 0, 'no pantry inserts when guest item matches account');
  assert(merged.pantryUpdates.length === 1, 'one pantry update when quantities merge');

  assert(merged.grocery.length === 2, 'grocery merge should keep account + guest rows');
  const limes = merged.grocery.find((row) => row.name === 'Limes');
  assert(Boolean(limes), 'guest grocery item should appear after merge');

  assert(merged.mealPlan.length === 2, 'meal plan merge should keep account + guest rows');
  assert(merged.mealPlanInserts.length === 1, 'one guest meal plan insert expected');
  const deduped = mergeGuestKitchenIntoAccount([], [], [], [], [mealPlanRow(42, 'Dup', 'a')], guestMealPlan);
  assert(deduped.mealPlanInserts.length === 0, 'duplicate recipeApiId meal plan rows should dedupe');

  const guestOnlyPantry = [pantryRow('Jasmine rice', 1, 'lb', 'guest-rice')];
  const guestOnlyMerge = mergeGuestKitchenIntoAccount([], [], guestOnlyPantry, []);
  assert(guestOnlyMerge.pantryInserts.length === 1, 'unmatched guest pantry rows should insert');

  clearGuestKitchenStorage();
  assert(readGuestPantry().length === 0, 'clearGuestKitchenStorage should empty pantry');
  assert(readGuestGrocery().length === 0, 'clearGuestKitchenStorage should empty grocery');
  assert(readGuestMealPlan().length === 0, 'clearGuestKitchenStorage should empty meal plan');

  console.log('guest-mode-check: OK');
}

main();
