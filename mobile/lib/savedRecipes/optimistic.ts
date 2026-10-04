import type { SavedRecipeRecord } from './types';

/** Optimistic list after toggling save (upsert or remove one ref). */
export function applySavedToggle(
  records: readonly SavedRecipeRecord[],
  refKey: string,
  nextRecord: SavedRecipeRecord | null,
): SavedRecipeRecord[] {
  if (nextRecord) {
    return [nextRecord, ...records.filter((row) => row.refKey !== refKey)];
  }
  return records.filter((row) => row.refKey !== refKey);
}

export function isRefKeySaved(records: readonly SavedRecipeRecord[], refKey: string): boolean {
  return records.some((row) => row.refKey === refKey);
}
