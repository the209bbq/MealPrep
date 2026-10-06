/**
 * Offline stale-login kitchen fallback.
 * Run from mobile/: npm run test:offline-stale-session
 */

import assert from 'node:assert/strict';
import {
  clearAccountKitchenCache,
  readAccountKitchenCache,
  writeAccountKitchenCache,
} from '../lib/account/accountKitchenCache';
import { clearLastAccountUserId, readLastAccountUserId, writeLastAccountUserId } from '../lib/account/lastAccountUser';
import { resolveOfflineKitchenUserId } from '../lib/account/offlineKitchenUser';

const userId = 'offline-stale-user';

clearLastAccountUserId();
clearAccountKitchenCache(userId);
assert.equal(resolveOfflineKitchenUserId(null), null);

writeLastAccountUserId(userId);
assert.equal(readLastAccountUserId(), userId);

writeAccountKitchenCache({
  userId,
  savedAt: new Date().toISOString(),
  profile: {
    id: userId,
    email: 'offline@example.com',
    name: 'Offline Tester',
    role: 'member',
    plan: 'plus',
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
  pantry: [{ id: 'p1', ingredientId: 'rice', name: 'Rice', category: 'dry_goods', quantity: 5, unit: 'lb', location: 'pantry', photoUri: null, expiresOn: null, updatedAt: new Date().toISOString() }],
  grocery: [],
  mealPlan: [],
  recipes: [],
});

if (!globalThis.navigator) {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
}
const originalOnLine = Object.getOwnPropertyDescriptor(globalThis.navigator, 'onLine');
Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, value: false });

assert.equal(resolveOfflineKitchenUserId(null), userId);
assert.ok(readAccountKitchenCache(userId)?.pantry.length === 1);

if (originalOnLine) {
  Object.defineProperty(globalThis.navigator, 'onLine', originalOnLine);
} else {
  Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, value: true });
}

clearAccountKitchenCache(userId);
clearLastAccountUserId();
console.log('offline-stale-session-check: ok');
