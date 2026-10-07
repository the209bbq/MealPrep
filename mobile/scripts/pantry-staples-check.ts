/**
 * Pure-logic checks for pantry staples picker (catalog, defaults, expiry, merge).
 */
import assert from 'node:assert/strict';
import { APP_ROUTES } from '../config/appRoutes.ts';
import {
  STAPLE_CATALOG,
  STAPLE_STORE_SECTIONS,
  defaultStapleSelection,
  getStapleById,
  resolveStapleQuantityUnit,
  resolveStapleVarietyIds,
  stapleSelectionToPantryItem,
  stapleSelectionToPantryItems,
  stapleSelectionsToPantryItems,
} from '../lib/pantry/stapleCatalog.ts';
import { STAPLE_VARIETY_OPTIONS } from '../lib/pantry/stapleVarietyOptions.ts';
import { addDaysToIsoDate, estimateExpiryFromShelfLife, isExpiringSoon, todayIsoDate } from '../lib/pantry/expiry.ts';
import { mergeStapleSelectionsIntoPantry } from '../lib/pantry/stapleMerge.ts';
import type { PantryItem } from '../types/mealprep.ts';

assert.equal(APP_ROUTES.pantryStaples, '/pantry-staples');

assert.ok(STAPLE_CATALOG.length >= 40 && STAPLE_CATALOG.length <= 60, `catalog size ${STAPLE_CATALOG.length}`);
const ids = new Set(STAPLE_CATALOG.map((row) => row.id));
assert.equal(ids.size, STAPLE_CATALOG.length, 'duplicate staple ids');

for (const section of STAPLE_STORE_SECTIONS) {
  const count = STAPLE_CATALOG.filter((row) => row.section === section).length;
  assert.ok(count > 0, `empty section ${section}`);
}

for (const staple of STAPLE_CATALOG) {
  const varieties = STAPLE_VARIETY_OPTIONS[staple.id];
  assert.ok(varieties && varieties.length >= 2, `${staple.id} missing variety options`);
  assert.ok(staple.varietyOptions?.length === varieties.length, `${staple.id} variety attach`);
  assert.ok(staple.defaultVarietyId, `${staple.id} missing defaultVarietyId`);
}

const onions = getStapleById('onions');
assert.ok(onions);
const onionPick = defaultStapleSelection(onions!);
assert.deepEqual(resolveStapleVarietyIds(onions!, onionPick), ['yellow']);
onionPick.varietyOptionIds = ['white', 'red', 'shallot'];
const onionRows = stapleSelectionToPantryItems(onionPick);
assert.equal(onionRows.length, 3);
assert.ok(onionRows.some((row) => row.name === 'White onion'));
assert.ok(onionRows.some((row) => row.name === 'Red onion'));
assert.ok(onionRows.some((row) => row.name === 'Shallots'));

const milk = getStapleById('milk');
assert.ok(milk);
const milkDefault = defaultStapleSelection(milk!);
assert.equal(milkDefault.sizeOptionId, 'gallon');
const milkQty = resolveStapleQuantityUnit(milk!, { stapleId: 'milk', sizeOptionId: 'quart' });
assert.equal(milkQty.unit, 'qt');
assert.equal(milkQty.quantity, 1);

const eggs = getStapleById('eggs');
assert.ok(eggs);
assert.equal(defaultStapleSelection(eggs!).sizeOptionId, '12');

const shelf = estimateExpiryFromShelfLife(7, new Date('2026-10-06T12:00:00Z'));
assert.equal(shelf, addDaysToIsoDate('2026-10-06', 7));

const soonItem: PantryItem = {
  id: '1',
  ingredientId: 'staple-milk',
  name: 'Milk',
  category: 'dairy',
  quantity: 1,
  unit: 'gal',
  location: 'fridge',
  photoUri: null,
  expiresOn: addDaysToIsoDate(todayIsoDate(new Date('2026-10-06T12:00:00Z')), 3),
  updatedAt: '2026-10-06T00:00:00.000Z',
};
assert.equal(isExpiringSoon(soonItem, 7, new Date('2026-10-06T12:00:00Z')), true);

const existing: PantryItem = {
  id: 'existing-milk',
  ingredientId: 'staple-milk-whole',
  name: 'Whole milk',
  category: 'dairy',
  quantity: 1,
  unit: 'gal',
  location: 'fridge',
  photoUri: null,
  expiresOn: null,
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const merged = mergeStapleSelectionsIntoPantry([existing], [defaultStapleSelection(milk!)]);
assert.equal(merged.insertedCount, 0, 'should merge not duplicate');
assert.equal(merged.pantry.length, 1);
assert.ok(merged.pantry[0].quantity > 1);

const rice = getStapleById('rice');
assert.ok(rice);
const rows = stapleSelectionsToPantryItems([
  defaultStapleSelection(rice!),
  defaultStapleSelection(getStapleById('onions')!),
]);
assert.equal(rows.length, 2);
const riceRow = stapleSelectionToPantryItem(defaultStapleSelection(rice!));
assert.ok(riceRow);
assert.equal(riceRow!.ingredientId, 'staple-rice-white');
assert.equal(riceRow!.name, 'White rice');

const milkRows = stapleSelectionToPantryItems({
  stapleId: 'milk',
  sizeOptionId: 'half_gallon',
  varietyOptionIds: ['whole', 'skim'],
});
assert.equal(milkRows.length, 2);
assert.equal(milkRows[0].unit, 'gal');
assert.equal(milkRows[0].quantity, 0.5);
assert.ok(milkRows.some((row) => row.name === 'Skim milk'));

console.log('pantry-staples-check: ok');
