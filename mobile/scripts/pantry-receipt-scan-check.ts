/**
 * Receipt scanning: bought items land in the same review list as a shelf scan, top up what is
 * already owned, and tick matching rows off the grocery list.
 * Run from mobile/: npm run test:pantry-vision
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHOTO_SCAN } from '../config/appConfig';
import { PANTRY_SCAN_UI_COPY } from '../config/pantryScan';
import { scanCardContent } from '../lib/pantry/scanCardContent';
import { mergePantryStock } from '../lib/pantry/mergePantryStock';
import {
  detectionsToReviewItems,
  groceryIdsBoughtOnReceipt,
  mergeSecondScanIntoReview,
  reviewItemsToPantryItems,
  summarizeScanAgainstPantry,
} from '../lib/pantryVision/reviewItems';
import type { PantryItem } from '../types/mealprep';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => fs.readFileSync(path.join(mobileRoot, rel), 'utf8').replace(/\r\n/g, '\n');

const line = (name: string, quantity: number, unit: string, confidence = 0.9) => ({
  name,
  quantity,
  unit,
  category: 'dry_goods' as const,
  confidence,
  storage: 'pantry',
});
const owned = (name: string, quantity: number, unit: string): PantryItem =>
  ({
    id: `p-${name}`,
    ingredientId: name.replace(/\s+/g, '-'),
    name,
    category: 'dry_goods',
    quantity,
    unit,
    location: 'pantry',
    updatedAt: '2026-10-01T00:00:00.000Z',
  }) as unknown as PantryItem;

const pantry = [owned('black beans', 1, 'can'), owned('rice', 1, 'bag')];
const receipt = [line('black beans', 3, 'can'), line('whole milk', 1, 'gallon'), line('bananas', 6, 'each')];

// --- A shelf scan hides what is already owned; a receipt keeps it, because more was bought ---
const asShelf = detectionsToReviewItems(receipt, pantry, [], null, false, 'pantry');
const asReceipt = detectionsToReviewItems(receipt, pantry, [], null, false, 'pantry', { includeAlreadyInPantry: true });
assert.equal(asShelf.length, 2, 'shelf scan: black beans already owned, hidden');
assert.equal(asReceipt.length, 3, 'receipt: all three bought lines are kept');
assert.ok(asReceipt.every((row) => row.enabled && row.photoUri === null));
const beans = asReceipt.find((row) => /black bean/i.test(row.name));
assert.ok(beans, 'black beans row present');
assert.equal(beans!.quantity, 3);

// The count line tells the shopper which lines are top-ups.
assert.deepEqual(summarizeScanAgainstPantry(receipt, pantry), { found: 3, alreadyInPantry: 1, fresh: 2 });
assert.equal(
  PANTRY_SCAN_UI_COPY.receiptSummary(3, 1),
  '3 items from your receipt. 1 top up things you already have.',
);
assert.equal(PANTRY_SCAN_UI_COPY.receiptSummary(1, 0), '1 item from your receipt.');

// --- Saving a receipt adds to the existing pantry row instead of creating a second one ---
const saved = mergePantryStock(pantry, reviewItemsToPantryItems(asReceipt));
const beanRows = saved.pantry.filter((row) => /black bean/i.test(row.name));
assert.equal(beanRows.length, 1, 'still one black beans row');
assert.equal(beanRows[0].quantity, 4, '1 owned + 3 bought');
assert.equal(saved.inserted.length, 2, 'milk and bananas are new rows');
assert.equal(saved.updated.length, 1, 'black beans is an update to the existing row');

// --- A long receipt in two photos: the second photo joins the list and keeps owned items too ---
const secondHalf = [line('rice', 2, 'bag'), line('whole milk', 1, 'gallon')];
const joined = mergeSecondScanIntoReview(asReceipt, secondHalf, pantry, [], 'pantry', { includeAlreadyInPantry: true });
assert.ok(joined.some((row) => row.name === 'rice'), 'owned rice from the second photo is kept');
assert.equal(joined.filter((row) => /milk/i.test(row.name)).length, 1, 'milk is not listed twice');
const withoutOption = mergeSecondScanIntoReview(asReceipt, secondHalf, pantry, [], 'pantry');
assert.ok(!withoutOption.some((row) => row.name === 'rice'), 'a shelf photo added to a list still hides owned items');

// --- Ticking the grocery list ---
const grocery = [
  { id: 'g1', name: 'Whole milk', ingredientId: 'whole-milk', checked: false },
  { id: 'g2', name: 'bananas', ingredientId: 'bananas', checked: false },
  { id: 'g3', name: 'olive oil', ingredientId: 'olive-oil', checked: false },
  { id: 'g4', name: 'black beans', ingredientId: 'black-beans', checked: true },
];
const bought = groceryIdsBoughtOnReceipt(asReceipt, grocery);
assert.deepEqual(bought.sort(), ['g1', 'g2'], 'bought rows are ticked; unbought and already-ticked rows are left alone');
// A line the shopper switched off in the review is not treated as bought.
const milkOff = asReceipt.map((row) => (/milk/i.test(row.name) ? { ...row, enabled: false } : row));
assert.deepEqual(groceryIdsBoughtOnReceipt(milkOff, grocery), ['g2']);
assert.deepEqual(groceryIdsBoughtOnReceipt([], grocery), []);
assert.deepEqual(groceryIdsBoughtOnReceipt(asReceipt, []), []);
assert.equal(PANTRY_SCAN_UI_COPY.groceryTickedOff(1), 'Ticked 1 item off your grocery list.');
assert.equal(PANTRY_SCAN_UI_COPY.groceryTickedOff(4), 'Ticked 4 items off your grocery list.');

// --- The card ---
const card = scanCardContent('receipt');
assert.equal(card.title, 'Scan a receipt');
assert.equal(card.icon, 'receipt-outline');
assert.notEqual(card.a11y, scanCardContent('shelf').a11y, 'the two cards have different screen-reader labels');
assert.equal(scanCardContent().title, PANTRY_SCAN_UI_COPY.scanCardTitle);
assert.equal(PHOTO_SCAN.receiptTiles.columns, 1);

// --- Wiring ---
const client = read('lib/pantryVision/client.ts');
assert.match(client, /action: kind === 'receipt' \? 'receipt' : undefined/);
assert.match(client, /\|\$\{kind\}`/, 'receipt and shelf results are cached apart');

const screen = read('app/(tabs)/pantry.tsx');
assert.match(screen, /variant="receipt"/);
assert.match(screen, /runVisionFromPrepared\(prepared, location, \{ kind: 'receipt' \}\)/);
assert.match(screen, /includeAlreadyInPantry: isReceipt/);
// The receipt photo is never uploaded to storage.
const uploadBlock = screen.slice(screen.indexOf('// A receipt photo is never kept'), screen.indexOf("const { detectionsToReviewItems"));
assert.match(uploadBlock, /if \(!isReceipt\) \{[\s\S]*uploadScanPhoto\(prepared, 'pantry', scanUserId\)/);
assert.equal((screen.match(/uploadScanPhoto\(/g) ?? []).length, 1);
// Grocery rows are ticked with the no-restock helper, after the pantry save, only for receipt lists.
const saveBlock = screen.slice(screen.indexOf('async function handleSaveReview'), screen.indexOf('function handleCancelReview'));
assert.ok(saveBlock.indexOf('await savePantryScanReview(') < saveBlock.indexOf('markGroceryItemsBought(boughtIds)'));
assert.match(saveBlock, /if \(reviewHasReceiptRef\.current\) \{/);
assert.doesNotMatch(saveBlock, /toggleGroceryItemsChecked|toggleGroceryItem\(/, 'the normal tick would add the items to the pantry a second time');

const context = read('context/AppContext.tsx');
const helper = context.slice(context.indexOf('const markGroceryItemsBought = useCallback('), context.indexOf('const markGroceryItemsBought = useCallback(') + 1400);
assert.match(helper, /updateGroceryChecked\(supabase, id, true\)/);
assert.doesNotMatch(helper, /restockGroceriesToPantry\(|groceryRestockLedgerRef\.current\.set/, 'ticking after a receipt never restocks');
assert.equal((context.match(/\n      markGroceryItemsBought,\n/g) ?? []).length, 2, 'exported from the context value and its dependency list');

// The web button file must not import a value from its own shared path (it would import itself on web).
const webButton = read('components/PantryStorageScanButtons.web.tsx');
assert.doesNotMatch(webButton, /import \{[^}]*\} from '\.\/PantryStorageScanButtons'/);
assert.match(webButton, /import type \{ PantryStorageScanButtonsProps \} from '\.\/PantryStorageScanButtons'/);
assert.match(webButton, /detailTiles: variant === 'receipt' \? 'receipt' : true/);

// Privacy page names receipt scanning before it ships (compliance rule 2).
const privacy = read('public/privacy.html').replace(/\s+/g, ' ');
assert.ok(privacy.includes('<strong>grocery receipt</strong>'));
assert.ok(privacy.includes('we do not keep the receipt photo'));

console.log('pantry-receipt-scan-check: ok');
