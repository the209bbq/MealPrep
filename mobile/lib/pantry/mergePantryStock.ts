import { suggestStorageLocationForPantryItem } from '../../config/pantryStorage';
import type { GroceryListItem, PantryCategory, PantryItem } from '../../types/mealprep';
import {
  fuzzyNameScore,
  ingredientMatchScore,
  normalizeIngredientName,
} from '../recipeMatch/ingredientNormalize';

function roundQty(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Whether `incoming` should merge into an existing pantry row (specific satisfies generic, not reverse). */
export function pantryItemsMatch(existing: PantryItem, incoming: PantryItem): boolean {
  if (existing.ingredientId && incoming.ingredientId && existing.ingredientId === incoming.ingredientId) {
    return true;
  }
  if (normalizeIngredientName(existing.name) === normalizeIngredientName(incoming.name)) return true;
  if (ingredientMatchScore(existing.name, incoming.name) >= 1) return true;
  return fuzzyNameScore(existing.name, incoming.name) >= 0.92;
}

export function mergePantryQuantities(existing: PantryItem, incoming: PantryItem): PantryItem {
  const sameUnit = existing.unit.toLowerCase() === incoming.unit.toLowerCase();
  const quantity = sameUnit
    ? roundQty(existing.quantity + incoming.quantity)
    : Math.max(existing.quantity, incoming.quantity);
  return {
    ...existing,
    quantity,
    category: incoming.category ?? existing.category,
    location: existing.location,
    scanPhotoPath: incoming.scanPhotoPath ?? existing.scanPhotoPath,
    photoUri: incoming.photoUri ?? existing.photoUri,
    expiresOn: incoming.expiresOn ?? existing.expiresOn,
    updatedAt: incoming.updatedAt,
  };
}

export interface MergePantryStockResult {
  pantry: PantryItem[];
  /** New rows added (not merged into an existing id). */
  inserted: PantryItem[];
  /** Existing rows whose quantity or metadata changed. */
  updated: PantryItem[];
}

/**
 * Merge incoming pantry rows into a list using ingredient identity rules
 * (specific satisfies generic; generic does not satisfy specific).
 */
export function mergePantryStock(
  accountPantry: PantryItem[],
  incoming: PantryItem[],
): MergePantryStockResult {
  if (incoming.length === 0) {
    return { pantry: accountPantry, inserted: [], updated: [] };
  }

  const merged = accountPantry.map((row) => ({ ...row }));
  const inserted: PantryItem[] = [];
  const updated: PantryItem[] = [];
  const accountIds = new Set(accountPantry.map((row) => row.id));

  for (const row of incoming) {
    const index = merged.findIndex((existing) => pantryItemsMatch(existing, row));
    if (index < 0) {
      merged.unshift(row);
      inserted.push(row);
      continue;
    }
    const combined = mergePantryQuantities(merged[index], row);
    if (
      combined.quantity !== merged[index].quantity ||
      combined.updatedAt !== merged[index].updatedAt
    ) {
      merged[index] = combined;
      if (accountIds.has(combined.id)) {
        updated.push(combined);
      }
    }
  }

  return { pantry: merged, inserted, updated };
}

function newPantryRowId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `00000000-0000-4000-8000-${Math.random().toString(16).slice(2, 14)}${Math.random().toString(16).slice(2, 6)}`;
}

export function groceryItemToPantryItem(item: GroceryListItem, now = new Date().toISOString()): PantryItem {
  const slug = item.name.toLowerCase().replace(/\s+/g, '-');
  const category = item.category as PantryCategory;
  return {
    id: newPantryRowId(),
    ingredientId: `grocery-${slug}`,
    name: item.name.trim(),
    category,
    quantity: item.quantity,
    unit: item.unit.trim() || 'each',
    location: suggestStorageLocationForPantryItem(item.name, category),
    photoUri: null,
    expiresOn: null,
    updatedAt: now,
  };
}

export function groceryItemsToPantryItems(items: GroceryListItem[]): PantryItem[] {
  const stamp = Date.now();
  return items.map((item, index) =>
    groceryItemToPantryItem(item, new Date(stamp + index).toISOString()),
  );
}
