import type { PantryItem } from '../../types/mealprep';

/** Stable string for pantry contents (order-independent). Used in hook deps and MealDB cache keys. */
export function pantrySnapshotKey(pantry: readonly PantryItem[]): string {
  return pantry
    .map((item) => `${item.ingredientId}:${item.name.trim().toLowerCase()}:${item.quantity}`)
    .filter(Boolean)
    .sort()
    .join('|');
}
