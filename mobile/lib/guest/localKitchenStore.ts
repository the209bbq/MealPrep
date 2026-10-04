import { GUEST_KITCHEN_STORAGE_KEYS } from '../../config/guestMode';
import { normalizePantryItemList } from '../../config/pantryStorage';
import { normalizeGroceryList } from '../grocery/origin';
import { readJson, removeStorageKey, writeJson } from '../storage';
import type { GroceryListItem, MealPlanItem, PantryItem, Recipe } from '../../types/mealprep';

export interface GuestKitchenSnapshot {
  pantry: PantryItem[];
  grocery: GroceryListItem[];
  mealPlan: MealPlanItem[];
  recipes: Recipe[];
}

export function readGuestPantry(): PantryItem[] {
  const raw = readJson<PantryItem[]>(GUEST_KITCHEN_STORAGE_KEYS.pantry, []);
  return normalizePantryItemList(raw);
}

export function writeGuestPantry(items: PantryItem[]): void {
  writeJson(GUEST_KITCHEN_STORAGE_KEYS.pantry, normalizePantryItemList(items));
}

export function readGuestGrocery(): GroceryListItem[] {
  return normalizeGroceryList(readJson<GroceryListItem[]>(GUEST_KITCHEN_STORAGE_KEYS.grocery, []));
}

export function writeGuestGrocery(items: GroceryListItem[]): void {
  writeJson(GUEST_KITCHEN_STORAGE_KEYS.grocery, items);
}

export function normalizeMealPlanItemList(items: MealPlanItem[]): MealPlanItem[] {
  return items.map((row) => ({
    ...row,
    scheduledOn: row.scheduledOn ?? null,
    mealSlot: row.mealSlot ?? null,
    madeAt: row.madeAt ?? null,
    leftoverOfId: row.leftoverOfId ?? null,
    linkedLeftoverId: row.linkedLeftoverId ?? null,
  }));
}

export function readGuestMealPlan(): MealPlanItem[] {
  return normalizeMealPlanItemList(readJson<MealPlanItem[]>(GUEST_KITCHEN_STORAGE_KEYS.mealPlan, []));
}

export function writeGuestMealPlan(items: MealPlanItem[]): void {
  writeJson(GUEST_KITCHEN_STORAGE_KEYS.mealPlan, normalizeMealPlanItemList(items));
}

export function readGuestRecipes(): Recipe[] {
  return readJson<Recipe[]>(GUEST_KITCHEN_STORAGE_KEYS.recipes, []);
}

export function writeGuestRecipes(items: Recipe[]): void {
  writeJson(GUEST_KITCHEN_STORAGE_KEYS.recipes, items);
}

export function readGuestKitchenSnapshot(): GuestKitchenSnapshot {
  return {
    pantry: readGuestPantry(),
    grocery: readGuestGrocery(),
    mealPlan: readGuestMealPlan(),
    recipes: readGuestRecipes(),
  };
}

export function clearGuestKitchenStorage(): void {
  removeStorageKey(GUEST_KITCHEN_STORAGE_KEYS.pantry);
  removeStorageKey(GUEST_KITCHEN_STORAGE_KEYS.grocery);
  removeStorageKey(GUEST_KITCHEN_STORAGE_KEYS.mealPlan);
  removeStorageKey(GUEST_KITCHEN_STORAGE_KEYS.recipes);
}

export function hasGuestKitchenData(snapshot?: GuestKitchenSnapshot): boolean {
  const data = snapshot ?? readGuestKitchenSnapshot();
  return (
    data.pantry.length > 0 ||
    data.grocery.length > 0 ||
    data.mealPlan.length > 0 ||
    data.recipes.length > 0
  );
}
