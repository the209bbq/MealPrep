import {
  fuzzyNameScore,
  ingredientMatchScore,
  normalizeIngredientName,
} from '../recipeMatch/ingredientNormalize';
import { groceryDedupeKey } from '../recipeMatch/groceryFromMissing';
import type { GroceryListItem, PantryItem } from '../../types/mealprep';

function roundQty(value: number): number {
  return Math.round(value * 100) / 100;
}

function pantryItemsMatch(a: PantryItem, b: PantryItem): boolean {
  if (a.ingredientId && b.ingredientId && a.ingredientId === b.ingredientId) return true;
  if (normalizeIngredientName(a.name) === normalizeIngredientName(b.name)) return true;
  if (ingredientMatchScore(a.name, b.name) >= 1) return true;
  return fuzzyNameScore(a.name, b.name) >= 0.92;
}

function mergePantryQuantities(existing: PantryItem, incoming: PantryItem): PantryItem {
  const sameUnit = existing.unit.toLowerCase() === incoming.unit.toLowerCase();
  const quantity = sameUnit
    ? roundQty(existing.quantity + incoming.quantity)
    : Math.max(existing.quantity, incoming.quantity);
  return {
    ...existing,
    quantity,
    scanPhotoPath: incoming.scanPhotoPath ?? existing.scanPhotoPath,
    photoUri: incoming.photoUri ?? existing.photoUri,
    updatedAt: incoming.updatedAt,
  };
}

export function mergeGuestPantryIntoAccount(
  accountPantry: PantryItem[],
  guestPantry: PantryItem[],
): { pantry: PantryItem[]; inserts: PantryItem[]; updates: PantryItem[] } {
  if (guestPantry.length === 0) {
    return { pantry: accountPantry, inserts: [], updates: [] };
  }

  const merged = accountPantry.map((row) => ({ ...row }));
  const inserts: PantryItem[] = [];
  const updates: PantryItem[] = [];
  const accountIds = new Set(accountPantry.map((row) => row.id));

  for (const guestItem of guestPantry) {
    const index = merged.findIndex((row) => pantryItemsMatch(row, guestItem));
    if (index < 0) {
      merged.unshift(guestItem);
      inserts.push(guestItem);
      continue;
    }
    const combined = mergePantryQuantities(merged[index], guestItem);
    if (combined.quantity !== merged[index].quantity || combined.updatedAt !== merged[index].updatedAt) {
      merged[index] = combined;
      if (accountIds.has(combined.id)) {
        updates.push(combined);
      }
    }
  }

  return { pantry: merged, inserts, updates };
}

function groceryRowsMatch(a: GroceryListItem, b: GroceryListItem): boolean {
  if (groceryDedupeKey(a.name, a.unit) === groceryDedupeKey(b.name, b.unit)) return true;
  return normalizeIngredientName(a.name) === normalizeIngredientName(b.name);
}

function mergeGroceryRows(existing: GroceryListItem, incoming: GroceryListItem): GroceryListItem {
  const sourceRecipeIds = [...new Set([...existing.sourceRecipeIds, ...incoming.sourceRecipeIds])];
  const sameUnit = existing.unit.toLowerCase() === incoming.unit.toLowerCase();
  const quantity = sameUnit
    ? roundQty(existing.quantity + incoming.quantity)
    : Math.max(existing.quantity, incoming.quantity);
  return {
    ...existing,
    quantity,
    checked: existing.checked && incoming.checked,
    sourceRecipeIds,
  };
}

export function mergeGuestGroceryIntoAccount(
  accountGrocery: GroceryListItem[],
  guestGrocery: GroceryListItem[],
): GroceryListItem[] {
  if (guestGrocery.length === 0) return accountGrocery;

  const merged = accountGrocery.map((row) => ({ ...row }));

  for (const guestItem of guestGrocery) {
    const index = merged.findIndex((row) => groceryRowsMatch(row, guestItem));
    if (index < 0) {
      merged.push(guestItem);
      continue;
    }
    merged[index] = mergeGroceryRows(merged[index], guestItem);
  }

  return merged;
}

export function mergeGuestKitchenIntoAccount(
  accountPantry: PantryItem[],
  accountGrocery: GroceryListItem[],
  guestPantry: PantryItem[],
  guestGrocery: GroceryListItem[],
): {
  pantry: PantryItem[];
  grocery: GroceryListItem[];
  pantryInserts: PantryItem[];
  pantryUpdates: PantryItem[];
} {
  const pantryMerge = mergeGuestPantryIntoAccount(accountPantry, guestPantry);
  const grocery = mergeGuestGroceryIntoAccount(accountGrocery, guestGrocery);
  return {
    pantry: pantryMerge.pantry,
    grocery,
    pantryInserts: pantryMerge.inserts,
    pantryUpdates: pantryMerge.updates,
  };
}
