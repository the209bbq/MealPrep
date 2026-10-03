import type { GroceryListItem, PantryItem } from '../../types/mealprep';
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
