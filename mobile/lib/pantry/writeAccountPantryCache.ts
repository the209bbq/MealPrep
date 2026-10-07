import { readAccountKitchenCache, writeAccountKitchenCache } from '../account/accountKitchenCache';
import type { PantryItem, UserProfile } from '../../types/mealprep';

/** Keep signed-in offline pantry edits in the account kitchen cache. */
export function writeAccountPantryCache(
  userId: string,
  pantry: PantryItem[],
  options?: { profile?: UserProfile | null },
): void {
  if (!userId) return;
  const cached = readAccountKitchenCache(userId);
  if (cached) {
    writeAccountKitchenCache({ ...cached, pantry, savedAt: new Date().toISOString() });
    return;
  }
  const profile = options?.profile;
  if (!profile || profile.id !== userId) return;
  writeAccountKitchenCache({
    userId,
    savedAt: new Date().toISOString(),
    profile,
    pantry,
    grocery: [],
    mealPlan: [],
    recipes: [],
  });
}
