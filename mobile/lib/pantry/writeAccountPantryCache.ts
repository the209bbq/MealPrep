import { readAccountKitchenCache, writeAccountKitchenCache } from '../account/accountKitchenCache';
import type { PantryItem } from '../../types/mealprep';

/** Keep signed-in offline pantry edits in the account kitchen cache. */
export function writeAccountPantryCache(userId: string, pantry: PantryItem[]): void {
  if (!userId) return;
  const cached = readAccountKitchenCache(userId);
  if (!cached) return;
  writeAccountKitchenCache({ ...cached, pantry, savedAt: new Date().toISOString() });
}
