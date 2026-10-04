import type { GroceryItemOrigin, GroceryListItem } from '../../types/mealprep';

const ORIGIN_RANK: Record<GroceryItemOrigin, number> = {
  plan: 1,
  add_missing: 2,
  manual: 3,
};

export function isGroceryOriginPinned(origin: GroceryItemOrigin): boolean {
  return origin !== 'plan';
}

export function normalizeGroceryOrigin(
  value: string | null | undefined,
  ingredientId: string,
): GroceryItemOrigin {
  if (value === 'plan' || value === 'add_missing' || value === 'manual') {
    return value;
  }
  if (ingredientId.startsWith('manual-')) return 'manual';
  return 'plan';
}

export function preferGroceryOrigin(a: GroceryItemOrigin, b: GroceryItemOrigin): GroceryItemOrigin {
  return ORIGIN_RANK[a] >= ORIGIN_RANK[b] ? a : b;
}

export function withGroceryOrigin<T extends GroceryListItem>(item: T, origin: GroceryItemOrigin): T {
  return { ...item, origin };
}

export function normalizeGroceryListItem(item: GroceryListItem): GroceryListItem {
  return {
    ...item,
    origin: normalizeGroceryOrigin(item.origin, item.ingredientId),
  };
}

export function normalizeGroceryList(items: GroceryListItem[]): GroceryListItem[] {
  return items.map((row) => normalizeGroceryListItem(row));
}
