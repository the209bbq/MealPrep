/**
 * Regression: kitchen reload must not wipe in-flight / optimistic pantry rows.
 * Run from mobile/: npm run test:pantry-load-merge
 */
import assert from 'node:assert/strict';
import {
  mergePantryStock,
  reconcilePantryAfterServerLoad,
} from '../lib/pantry/mergePantryStock.ts';
import type { PantryItem } from '../types/mealprep.ts';

function row(partial: Partial<PantryItem> & Pick<PantryItem, 'id' | 'name'>): PantryItem {
  return {
    ingredientId: partial.ingredientId ?? `ing-${partial.id}`,
    category: partial.category ?? 'produce',
    quantity: partial.quantity ?? 1,
    unit: partial.unit ?? 'each',
    location: partial.location ?? 'pantry',
    photoUri: null,
    expiresOn: null,
    updatedAt: partial.updatedAt ?? '2026-10-07T00:00:00.000Z',
    ...partial,
  };
}

const serverPantry: PantryItem[] = [row({ id: 'srv-1', name: 'Rice', ingredientId: 'staple-rice-white' })];

const optimisticDuringLoad: PantryItem[] = [
  row({
    id: 'manual-1',
    name: 'Tomatoes',
    ingredientId: 'manual-tomatoes',
    location: 'fridge',
  }),
  row({
    id: 'staple-1',
    name: 'Whole milk',
    ingredientId: 'staple-milk-whole',
    category: 'dairy',
    location: 'fridge',
  }),
];

const merged = mergePantryStock(serverPantry, optimisticDuringLoad).pantry;
assert.equal(merged.length, 3, 'mergePantryStock: server rows plus optimistic rows should all remain');
assert.ok(merged.some((item) => item.id === 'manual-1'));
assert.ok(merged.some((item) => item.id === 'staple-1'));
assert.ok(merged.some((item) => item.id === 'srv-1'));

const emptyServer = mergePantryStock([], optimisticDuringLoad).pantry;
assert.equal(emptyServer.length, 2, 'empty server fetch must not discard local rows');

const oliveServer = row({
  id: 'srv-olive',
  name: 'Olive oil',
  ingredientId: 'olive-oil',
  quantity: 5,
  unit: 'oz',
});
const oliveCache = row({
  id: 'srv-olive',
  name: 'Olive oil',
  ingredientId: 'olive-oil',
  quantity: 5,
  unit: 'oz',
});
const afterLoad = reconcilePantryAfterServerLoad([oliveServer], [oliveCache]);
assert.equal(afterLoad.length, 1);
assert.equal(afterLoad[0]?.quantity, 5, 'RG-1: same row from cache + server must not double');

const pendingInsert = row({
  id: 'local-only-1',
  name: 'Tomatoes',
  ingredientId: 'manual-tomatoes',
  quantity: 2,
  unit: 'each',
});
const withPending = reconcilePantryAfterServerLoad([oliveServer], [oliveCache, pendingInsert]);
assert.equal(withPending.length, 2);
assert.ok(withPending.some((item) => item.id === 'local-only-1'), 'pending local-only insert survives load');

const secondPass = reconcilePantryAfterServerLoad([oliveServer], withPending);
assert.equal(secondPass.find((item) => item.id === 'srv-olive')?.quantity, 5);
assert.equal(secondPass.length, 2, 'repeated loads stay stable');

console.log('pantry-load-merge-check: ok');
