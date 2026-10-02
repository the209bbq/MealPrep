/**
 * Pantry scan condense + grocery restock regression checks.
 */
import {
  readLastPantryScanLocation,
  writeLastPantryScanLocation,
  PANTRY_LAST_SCAN_LOCATION_STORAGE_KEY,
} from '../config/pantryScan';
import { suggestStorageLocationForCategory } from '../config/pantryStorage';
import { reviewItemsToPantryItems } from '../lib/pantryVision/reviewItems';
import type { PantryScanReviewItem } from '../lib/pantryVision/types';
import {
  groceryItemsToPantryItems,
  mergePantryStock,
  pantryItemsMatch,
} from '../lib/pantry/mergePantryStock';
import { removeStorageKey } from '../lib/storage';
import type { GroceryListItem, PantryItem } from '../types/mealprep';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function pantryRow(partial: Partial<PantryItem> & Pick<PantryItem, 'name'>): PantryItem {
  const now = new Date().toISOString();
  return {
    id: partial.id ?? `id-${partial.name}`,
    ingredientId: partial.ingredientId ?? `ing-${partial.name}`,
    name: partial.name,
    category: partial.category ?? 'dry_goods',
    quantity: partial.quantity ?? 1,
    unit: partial.unit ?? 'each',
    location: partial.location ?? 'pantry',
    photoUri: null,
    expiresOn: null,
    updatedAt: now,
    ...partial,
  };
}

// --- last scan location ---
removeStorageKey(PANTRY_LAST_SCAN_LOCATION_STORAGE_KEY);
assert(readLastPantryScanLocation() === 'pantry', 'default last scan location is pantry');
writeLastPantryScanLocation('fridge');
assert(readLastPantryScanLocation() === 'fridge', 'persist last scan location');
removeStorageKey(PANTRY_LAST_SCAN_LOCATION_STORAGE_KEY);

// --- category → storage inference ---
assert(suggestStorageLocationForCategory('frozen') === 'fridge', 'frozen items default to fridge');
assert(suggestStorageLocationForCategory('dairy') === 'fridge', 'dairy defaults to fridge');
assert(suggestStorageLocationForCategory('meats') === 'fridge', 'meats default to fridge');
assert(suggestStorageLocationForCategory('dry_goods') === 'pantry', 'dry goods default to pantry');

// --- save-all review rows ---
const reviewRows: PantryScanReviewItem[] = [
  {
    key: 'a',
    enabled: true,
    name: 'Rice',
    quantity: 2,
    unit: 'cup',
    category: 'dry_goods',
    confidence: 0.9,
    ingredientId: 'rice',
    location: 'pantry',
    photoUri: null,
    isDemoSample: false,
    needsReview: false,
  },
  {
    key: 'b',
    enabled: false,
    name: 'Salt',
    quantity: 1,
    unit: 'tsp',
    category: 'spices',
    confidence: 0.9,
    ingredientId: 'salt',
    location: 'spice_rack',
    photoUri: null,
    isDemoSample: false,
    needsReview: false,
  },
];
const saved = reviewItemsToPantryItems(reviewRows);
assert(saved.length === 1, 'save-all keeps only enabled review rows');
assert(saved[0].name === 'Rice', 'enabled row is saved');

// --- restock merge identity ---
const existing = pantryRow({ id: 'chicken-1', name: 'chicken breast', quantity: 1, unit: 'lb' });
const incoming = pantryRow({ id: 'chicken-2', name: 'boneless chicken breast 2 lb', quantity: 2, unit: 'lb' });
assert(pantryItemsMatch(existing, incoming), 'boneless chicken breast merges with chicken breast');
const merged = mergePantryStock([existing], [incoming]);
assert(merged.pantry.length === 1, 'merge combines rows');
assert(merged.pantry[0].quantity === 3, 'merge sums same-unit quantities');
assert(merged.pantry[0].id === 'chicken-1', 'merge keeps existing row id');

const groundExisting = pantryRow({ name: 'ground beef', quantity: 1, unit: 'lb' });
const genericIncoming = pantryRow({ name: 'beef', quantity: 1, unit: 'lb' });
assert(
  !pantryItemsMatch(groundExisting, genericIncoming),
  'generic beef does not merge into existing ground beef row',
);

// --- grocery → pantry + undo snapshot ---
const grocery: GroceryListItem[] = [
  {
    id: 'g1',
    name: 'Greek yogurt',
    quantity: 2,
    unit: 'cup',
    category: 'dairy',
    checked: true,
    sourceRecipeIds: [],
  },
];
const fromGrocery = groceryItemsToPantryItems(grocery);
assert(fromGrocery[0].location === 'fridge', 'grocery restock infers fridge for dairy');
const before = [pantryRow({ name: 'oats', quantity: 1, unit: 'cup' })];
const afterMerge = mergePantryStock(before, fromGrocery);
const restored = before.map((row) => ({ ...row }));
assert(afterMerge.pantry.length === 2, 'restock adds new pantry row');
assert(restored.length === 1 && restored[0].name === 'oats', 'undo snapshot preserves prior pantry');

console.log('pantry-scan-restock-regression: ok');
