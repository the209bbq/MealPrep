/**
 * Signed-in kitchen offline cache round-trip.
 * Run from mobile/: npm run test:account-offline-cache
 */

import assert from 'node:assert/strict';
import {
  clearAccountKitchenCache,
  readAccountKitchenCache,
  writeAccountKitchenCache,
} from '../lib/account/accountKitchenCache';
import { isUserImportedKitchenRecipe } from '../lib/recipeImport/mapToAppRecipe';
import type { Recipe } from '../types/mealprep';

const userId = 'user-offline-test';

clearAccountKitchenCache(userId);
assert.equal(readAccountKitchenCache(userId), null);

writeAccountKitchenCache({
  userId,
  savedAt: new Date().toISOString(),
  profile: {
    id: userId,
    email: 'a@example.com',
    name: 'Tester',
    role: 'member',
    plan: 'free',
    photoUrl: null,
    householdSize: 2,
    dietaryNotes: '',
    createdAt: new Date().toISOString(),
    preferences: {
      autoAddMissingToGrocery: true,
      addCheckedItemsToPantry: true,
      shareScanPhotoForTraining: false,
    },
  },
  pantry: [],
  grocery: [],
  mealPlan: [],
  recipes: [],
});

const hit = readAccountKitchenCache(userId);
assert.ok(hit?.profile.name === 'Tester');

const photoRecipe: Recipe = {
  id: 'photo-import-abc-xyz',
  name: 'Pedernales River Chili',
  tag: 'Imported · Photo',
  description: '',
  servings: 6,
  minutes: 30,
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  ingredients: [],
  steps: [],
  isMaster: false,
  createdAt: '',
  sourceType: 'photo',
  sourceUrl: 'photo-scan',
};

assert.equal(isUserImportedKitchenRecipe(photoRecipe), true);

clearAccountKitchenCache(userId);
console.log('account-offline-cache-check: ok');
