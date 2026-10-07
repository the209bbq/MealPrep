/**
 * Pantry P2-1 / P2-2: cancel in-flight manual insert on delete; rollback failed online insert.
 * Run from mobile/: npm run test:pantry-manual-add-race
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManualPantryItem, prependPantryItem } from '../lib/pantry/manualPantryItem.ts';
import {
  cancelManualInsert,
  createManualInsertCoordinator,
  isManualInsertCancelled,
  mergeSavedManualPantryItem,
  rollbackManualPantryItem,
  trackManualInsert,
} from '../lib/pantry/manualPantryInsertLifecycle.ts';
import type { PantryItem } from '../types/mealprep.ts';

const now = 1_700_000_000_000;
const item = buildManualPantryItem(
  {
    name: 'R2 Gate Ghost',
    quantity: 1,
    unit: 'each',
    category: 'produce',
    location: 'pantry',
  },
  now,
);
const saved: PantryItem = {
  ...item,
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  updatedAt: new Date(now + 1000).toISOString(),
};

// P2-1: delete before insert resolves → drop server row, keep pantry without item
const coordinator = createManualInsertCoordinator();
trackManualInsert(coordinator, item.id);
let pantry = prependPantryItem([], item);
cancelManualInsert(coordinator, item.id);
pantry = pantry.filter((row) => row.id !== item.id);
assert.equal(isManualInsertCancelled(coordinator, item.id), true);

const afterInsert = mergeSavedManualPantryItem(pantry, item.id, saved, true);
assert.equal(afterInsert.pantry.length, 0);
assert.equal(afterInsert.shouldDeleteServerId, saved.id);

// P2-2: failed insert rolls back optimistic row
const keeper: PantryItem = { ...item, id: 'manual-keeper', name: 'Keep' };
const optimistic = prependPantryItem([keeper], item);
const rolledBack = rollbackManualPantryItem(optimistic, item.id);
assert.equal(rolledBack.length, 1);
assert.equal(rolledBack[0].name, 'Keep');

// Happy path: insert applies server id when still present
const pending = prependPantryItem([], item);
const merged = mergeSavedManualPantryItem(pending, item.id, saved, false);
assert.equal(merged.shouldDeleteServerId, null);
assert.equal(merged.pantry[0].id, saved.id);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const appContextSource = fs.readFileSync(path.join(mobileRoot, 'context/AppContext.tsx'), 'utf8');
assert.match(appContextSource, /trackManualInsert\(pendingManualPantryInsertsRef\.current, item\.id\)/);
assert.match(appContextSource, /cancelManualInsert\(pendingManualPantryInsertsRef\.current, id\)/);
assert.match(appContextSource, /rollbackManualPantryItem\(prev, item\.id\)/);
assert.match(appContextSource, /throw error instanceof Error \? error : new Error\('Failed to add pantry item'\)/);
assert.match(appContextSource, /if \(!isManualPantryLocalId\(id\)\)/);

console.log('pantry-manual-add-race-check: ok');
