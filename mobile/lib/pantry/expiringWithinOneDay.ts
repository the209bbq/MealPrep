import type { PantryItem } from '../../types/mealprep';
import { isExpiringSoon } from './expiry';

export function isPantryItemExpiringWithinOneDay(
  item: Pick<PantryItem, 'expiresOn'>,
  now = new Date(),
): boolean {
  return isExpiringSoon(item, 1, now);
}

export function filterPantryExpiringWithinOneDay(
  items: readonly PantryItem[],
  now = new Date(),
): PantryItem[] {
  return items.filter((item) => isPantryItemExpiringWithinOneDay(item, now));
}

export function fingerprintPantryItemIds(ids: readonly string[]): string {
  return [...ids].sort().join('\0');
}
