import { GUEST_KITCHEN_STORAGE_KEYS } from '../../config/guestMode';
import { normalizePantryItemList } from '../../config/pantryStorage';
import { readJson, removeStorageKey, writeJson } from '../storage';
import type { GroceryListItem, PantryItem } from '../../types/mealprep';

export interface GuestKitchenSnapshot {
  pantry: PantryItem[];
  grocery: GroceryListItem[];
}

export function readGuestPantry(): PantryItem[] {
  const raw = readJson<PantryItem[]>(GUEST_KITCHEN_STORAGE_KEYS.pantry, []);
  return normalizePantryItemList(raw);
}

export function writeGuestPantry(items: PantryItem[]): void {
  writeJson(GUEST_KITCHEN_STORAGE_KEYS.pantry, normalizePantryItemList(items));
}

export function readGuestGrocery(): GroceryListItem[] {
  return readJson<GroceryListItem[]>(GUEST_KITCHEN_STORAGE_KEYS.grocery, []);
}

export function writeGuestGrocery(items: GroceryListItem[]): void {
  writeJson(GUEST_KITCHEN_STORAGE_KEYS.grocery, items);
}

export function readGuestKitchenSnapshot(): GuestKitchenSnapshot {
  return {
    pantry: readGuestPantry(),
    grocery: readGuestGrocery(),
  };
}

export function clearGuestKitchenStorage(): void {
  removeStorageKey(GUEST_KITCHEN_STORAGE_KEYS.pantry);
  removeStorageKey(GUEST_KITCHEN_STORAGE_KEYS.grocery);
}

export function hasGuestKitchenData(snapshot?: GuestKitchenSnapshot): boolean {
  const data = snapshot ?? readGuestKitchenSnapshot();
  return data.pantry.length > 0 || data.grocery.length > 0;
}
