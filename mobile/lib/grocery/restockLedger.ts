import type { GroceryListItem, PantryItem } from '../../types/mealprep';
import { normalizeIngredientName } from '../recipeMatch/normalize';
import { convertQuantity, unitsAreConvertible } from '../units/conversion';
import { groceryItemsToPantryItems } from '../pantry/mergePantryStock';
import { mergePantryStock, pantryItemsMatch } from '../pantry/mergePantryStock';

export interface GroceryRestockLedgerEntry {
  pantryItemId: string;
  quantityAdded: number;
  unit: string;
}

function roundQty(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Apply grocery check restock once per item; returns updated pantry. */
export function applyGroceryCheckRestock(
  pantry: PantryItem[],
  item: GroceryListItem,
  ledger: Map<string, GroceryRestockLedgerEntry>,
): PantryItem[] {
  if (ledger.has(item.id)) return pantry;
  const incoming = groceryItemsToPantryItems([item]);
  const merged = mergePantryStock(pantry, incoming);
  const incomingRow = incoming[0];
  const target = merged.pantry.find((row) => pantryItemsMatch(row, incomingRow));
  if (target) {
    ledger.set(item.id, {
      pantryItemId: target.id,
      quantityAdded: item.quantity,
      unit: item.unit.trim().toLowerCase(),
    });
  }
  return merged.pantry;
}

function groceryRestockMergeKey(item: Pick<GroceryListItem, 'name'>): string {
  return normalizeIngredientName(item.name);
}

/** Rows to restock for one merged ingredient (may be multiple when units do not convert). */
export function consolidateGroceryItemsForRestock(items: GroceryListItem[]): GroceryListItem[] {
  if (items.length <= 1) return items;

  const base = items[0]!;
  let quantity = base.quantity;
  let unit = base.unit;
  const altByUnit = new Map<string, number>();

  for (const item of items.slice(1)) {
    if (item.unit === unit) {
      quantity = roundQty(quantity + item.quantity);
      continue;
    }
    if (unitsAreConvertible(unit, item.unit)) {
      const converted = convertQuantity(item.quantity, item.unit, unit);
      if (converted != null) {
        quantity = roundQty(quantity + converted);
        continue;
      }
    }
    const unitKey = item.unit.trim().toLowerCase();
    altByUnit.set(unitKey, roundQty((altByUnit.get(unitKey) ?? 0) + item.quantity));
  }

  const rows: GroceryListItem[] = [{ ...base, quantity, unit }];
  for (const [unitKey, qty] of altByUnit) {
    const sample = items.find((row) => row.unit.trim().toLowerCase() === unitKey) ?? base;
    rows.push({ ...sample, quantity: qty, unit: sample.unit });
  }
  return rows;
}

/**
 * Restock pantry from one or more checked grocery lines without double-adding merged ingredients.
 * Ledger entries remain per grocery row id for per-line undo.
 */
export function applyGroceryCheckRestockBatch(
  pantry: PantryItem[],
  items: GroceryListItem[],
  ledger: Map<string, GroceryRestockLedgerEntry>,
): PantryItem[] {
  const pending = items.filter((item) => !ledger.has(item.id));
  if (pending.length === 0) return pantry;

  const groups = new Map<string, GroceryListItem[]>();
  for (const item of pending) {
    const key = groceryRestockMergeKey(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  let nextPantry = pantry;
  for (const groupItems of groups.values()) {
    const consolidatedRows = consolidateGroceryItemsForRestock(groupItems);
    const scratchLedger = new Map<string, GroceryRestockLedgerEntry>();
    for (const consolidated of consolidatedRows) {
      nextPantry = applyGroceryCheckRestock(nextPantry, consolidated, scratchLedger);
    }

    for (const item of groupItems) {
      const matchingRow =
        consolidatedRows.find((row) => row.unit.trim().toLowerCase() === item.unit.trim().toLowerCase()) ??
        consolidatedRows[0];
      const entry = scratchLedger.get(item.id) ?? (matchingRow ? scratchLedger.get(matchingRow.id) : undefined);
      if (!entry) continue;
      ledger.set(item.id, {
        pantryItemId: entry.pantryItemId,
        quantityAdded: item.quantity,
        unit: item.unit.trim().toLowerCase(),
      });
    }
  }

  return nextPantry;
}

/** Reverse a prior check restock when the user unchecks the grocery line. */
export function reverseGroceryCheckRestock(
  pantry: PantryItem[],
  groceryItemId: string,
  ledger: Map<string, GroceryRestockLedgerEntry>,
): PantryItem[] {
  const entry = ledger.get(groceryItemId);
  if (!entry) return pantry;
  ledger.delete(groceryItemId);

  const index = pantry.findIndex((row) => row.id === entry.pantryItemId);
  if (index < 0) return pantry;

  const row = pantry[index];
  const sameUnit = row.unit.trim().toLowerCase() === entry.unit;
  if (!sameUnit) return pantry;

  const nextQty = roundQty(row.quantity - entry.quantityAdded);
  if (nextQty <= 0) {
    return pantry.filter((_, i) => i !== index);
  }
  const next = pantry.map((r, i) => (i === index ? { ...r, quantity: nextQty } : r));
  return next;
}
