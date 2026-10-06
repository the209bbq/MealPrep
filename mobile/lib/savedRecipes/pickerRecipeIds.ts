import { mealDbRecipeId } from '../mealdb/slug';
import { parseSavedRefKey } from './keys';
import type { SavedRecipeRecord } from './types';

/** Kitchen recipe ids for saved / bookmarked recipes shown in the meal picker. */
export function savedKitchenRecipeIdsFromRecords(records: readonly SavedRecipeRecord[]): Set<string> {
  const ids = new Set<string>();
  for (const record of records) {
    const parsed = parseSavedRefKey(record.refKey);
    if (!parsed) continue;
    if (parsed.type === 'kitchen') {
      ids.add(parsed.id);
      continue;
    }
    if (parsed.type === 'mealdb') {
      ids.add(mealDbRecipeId(parsed.id));
      if (record.kitchenRecipeId) ids.add(record.kitchenRecipeId);
      continue;
    }
  }
  return ids;
}
