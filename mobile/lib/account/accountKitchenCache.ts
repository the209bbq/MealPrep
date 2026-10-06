import { readJson, removeStorageKey, writeJson } from '../storage';
import type { GroceryListItem, MealPlanItem, PantryItem, Recipe, UserProfile } from '../../types/mealprep';

export interface AccountKitchenCache {
  userId: string;
  savedAt: string;
  profile: UserProfile;
  pantry: PantryItem[];
  grocery: GroceryListItem[];
  mealPlan: MealPlanItem[];
  recipes: Recipe[];
}

const CACHE_KEY_PREFIX = 'mealprep.accountKitchenCache.';

function cacheKey(userId: string): string {
  return `${CACHE_KEY_PREFIX}${userId}`;
}

export function readAccountKitchenCache(userId: string): AccountKitchenCache | null {
  if (!userId) return null;
  const raw = readJson<AccountKitchenCache | null>(cacheKey(userId), null);
  if (!raw || raw.userId !== userId) return null;
  return raw;
}

export function writeAccountKitchenCache(snapshot: AccountKitchenCache): void {
  if (!snapshot.userId) return;
  writeJson(cacheKey(snapshot.userId), snapshot);
}

export function clearAccountKitchenCache(userId: string): void {
  if (!userId) return;
  removeStorageKey(cacheKey(userId));
}
