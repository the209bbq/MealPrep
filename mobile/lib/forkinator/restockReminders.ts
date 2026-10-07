import type { GroceryListItem, PantryItem } from '../../types/mealprep';
import {
  defaultStapleSelection,
  getStapleById,
  resolveStapleQuantityUnit,
  STAPLE_CATALOG,
  type StapleCatalogEntry,
} from '../pantry/stapleCatalog';
import type { PantryCategory } from '../../types/mealprep';

/** Staples at or below this fraction of their reference pack size count as low. */
export const STAPLE_LOW_STOCK_FRACTION = 0.25;

export interface ParsedStapleIngredient {
  stapleId: string;
  varietyId?: string;
}

export function parseStapleIngredientId(ingredientId: string): ParsedStapleIngredient | null {
  if (!ingredientId.startsWith('staple-')) return null;
  const rest = ingredientId.slice('staple-'.length);
  if (!rest) return null;
  const catalogIds = new Set(STAPLE_CATALOG.map((entry) => entry.id));
  for (const stapleId of catalogIds) {
    if (rest === stapleId) return { stapleId };
    if (rest.startsWith(`${stapleId}-`)) {
      return { stapleId, varietyId: rest.slice(stapleId.length + 1) };
    }
  }
  return null;
}

export function stapleReferenceQuantity(staple: StapleCatalogEntry): number {
  return resolveStapleQuantityUnit(staple, defaultStapleSelection(staple)).quantity;
}

export function isStaplePantryQuantityLow(
  staple: StapleCatalogEntry,
  quantity: number,
  unit: string,
): boolean {
  if (quantity <= 0) return true;
  const reference = stapleReferenceQuantity(staple);
  const refUnit = resolveStapleQuantityUnit(staple, defaultStapleSelection(staple)).unit;
  if (unit !== refUnit) {
    return quantity <= reference * STAPLE_LOW_STOCK_FRACTION;
  }
  return quantity <= reference * STAPLE_LOW_STOCK_FRACTION;
}

export interface StapleRestockLine {
  stapleId: string;
  name: string;
  quantity: number;
  unit: string;
  category: PantryCategory;
  /** Pantry row the restock size/variety was inferred from (if any). */
  sourcePantryItemId?: string;
}

function inferRestockFromPantryRow(
  staple: StapleCatalogEntry,
  item: PantryItem,
): Pick<StapleRestockLine, 'quantity' | 'unit' | 'name'> {
  const sizeMatch = staple.sizeOptions?.find((opt) => opt.unit === item.unit);
  if (sizeMatch) {
    return { name: item.name, quantity: sizeMatch.quantity, unit: sizeMatch.unit };
  }
  const fallback = resolveStapleQuantityUnit(staple, defaultStapleSelection(staple));
  return { name: item.name, quantity: fallback.quantity, unit: fallback.unit };
}

function groceryHasStapleLine(
  grocery: readonly GroceryListItem[],
  name: string,
  unit: string,
): boolean {
  const normalized = name.trim().toLowerCase();
  return grocery.some(
    (row) => !row.checked && row.name.trim().toLowerCase() === normalized && row.unit === unit,
  );
}

/**
 * Staples in the catalog that are low or out in `pantry`, excluding items already on the open grocery list.
 */
export function planStapleRestockLines(
  pantry: readonly PantryItem[],
  grocery: readonly GroceryListItem[],
): StapleRestockLine[] {
  const lines: StapleRestockLine[] = [];
  const pantryByStaple = new Map<string, PantryItem[]>();

  for (const item of pantry) {
    const parsed = parseStapleIngredientId(item.ingredientId);
    if (!parsed) continue;
    const bucket = pantryByStaple.get(parsed.stapleId) ?? [];
    bucket.push(item);
    pantryByStaple.set(parsed.stapleId, bucket);
  }

  for (const staple of STAPLE_CATALOG) {
    const rows = pantryByStaple.get(staple.id) ?? [];
    if (rows.length === 0) continue;

    const lowRows = rows.filter((row) =>
      isStaplePantryQuantityLow(staple, row.quantity, row.unit),
    );
    if (lowRows.length === 0) continue;

    const source = lowRows[0] ?? rows[0];
    const restock = inferRestockFromPantryRow(staple, source);
    if (groceryHasStapleLine(grocery, restock.name, restock.unit)) continue;

    lines.push({
      stapleId: staple.id,
      name: restock.name,
      quantity: restock.quantity,
      unit: restock.unit,
      category: staple.category,
      sourcePantryItemId: source.id,
    });
  }

  return lines;
}

export function buildRestockReminderMessage(stapleNames: readonly string[]): string {
  const names = stapleNames.map((name) => name.trim()).filter(Boolean);
  if (names.length === 0) {
    return "You're running low on staples, so I added them to your grocery list.";
  }
  if (names.length === 1) {
    return `You're running low on ${names[0]}, so I added it to your grocery list.`;
  }
  if (names.length === 2) {
    return `You're running low on ${names[0]} and ${names[1]}, so I added them to your grocery list.`;
  }
  const more = names.length - 2;
  return `You're running low on ${names[0]}, ${names[1]}, and ${more} more, so I added them to your grocery list.`;
}

export function stapleDisplayNameForMessage(stapleId: string, fallbackName: string): string {
  const staple = getStapleById(stapleId);
  if (!staple) return fallbackName;
  return staple.name.toLowerCase();
}
