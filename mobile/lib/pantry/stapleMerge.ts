import { mergePantryStock } from './mergePantryStock';
import type { PantryItem } from '../../types/mealprep';
import { stapleSelectionsToPantryItems, type StapleSelectionState } from './stapleCatalog';

export interface StaplePantryMergeResult {
  pantry: PantryItem[];
  insertedCount: number;
  updatedCount: number;
}

/** Convert staple picks to pantry rows and merge without duplicate lines. */
export function mergeStapleSelectionsIntoPantry(
  accountPantry: PantryItem[],
  selections: StapleSelectionState[],
  now = new Date().toISOString(),
): StaplePantryMergeResult {
  const incoming = stapleSelectionsToPantryItems(selections, now);
  const { pantry, inserted, updated } = mergePantryStock(accountPantry, incoming);
  return {
    pantry,
    insertedCount: inserted.length,
    updatedCount: updated.length,
  };
}

/** Count of net-new rows that would be inserted (ignores quantity-only merges). */
export function countStapleAdds(selections: StapleSelectionState[], accountPantry: PantryItem[]): number {
  return mergeStapleSelectionsIntoPantry(accountPantry, selections).insertedCount;
}
