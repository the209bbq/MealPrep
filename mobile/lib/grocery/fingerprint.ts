import type { GroceryListItem } from '../../types/mealprep';

/** Stable fingerprint for skipping no-op grocery rebuilds/persistence. */
export function groceryListFingerprint(items: readonly GroceryListItem[]): string {
  return items
    .map(
      (item) =>
        `${item.id}|${item.ingredientId}|${item.unit}|${item.name}|${item.quantity}|${item.checked}|${item.category}|${item.origin}|${item.sourceRecipeIds.slice().sort().join(',')}`,
    )
    .sort()
    .join('\n');
}

export function groceryListsEqual(a: readonly GroceryListItem[], b: readonly GroceryListItem[]): boolean {
  if (a.length !== b.length) return false;
  return groceryListFingerprint(a) === groceryListFingerprint(b);
}
