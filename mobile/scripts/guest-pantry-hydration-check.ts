/**
 * Regression: guest pantry must not be wiped before hydration reads storage.
 * Run from mobile/: npm run test:guest-pantry-hydration
 */

import {
  clearGuestKitchenStorage,
  readGuestPantry,
  writeGuestPantry,
} from '../lib/guest/localKitchenStore';
import type { PantryItem } from '../types/mealprep';

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
): void {
  if (guestKitchenHydrated) {
    writeGuestPantry(pantry);
  }
}

clearGuestKitchenStorage();
const saved = [row('Chicken breast', 'guest-chicken')];
writeGuestPantry(saved);

let guestKitchenHydrated = false;
let pantry: PantryItem[] = [];

// Initial empty state before hydration (AppProvider mount).
pantry = [];
simulateGuestPersistence(guestKitchenHydrated, pantry);
assert(readGuestPantry().length === 1, 'empty pre-hydration pantry must not overwrite stored guest pantry');

guestKitchenHydrated = true;
pantry = readGuestPantry();
simulateGuestPersistence(guestKitchenHydrated, pantry);
assert(readGuestPantry().length === 1, 'hydrated guest pantry should persist after read');

console.log('guest-pantry-hydration-check: ok');
