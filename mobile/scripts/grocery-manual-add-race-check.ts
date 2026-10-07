/**
 * G1-2: grocery manual add — cancel in-flight insert on delete; rollback failed online insert.
 * Run from mobile/: npm run test:grocery-manual-add-race
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createManualGroceryItem } from '../lib/grocery.ts';
import {
  cancelManualGroceryInsert,
  createManualGroceryInsertCoordinator,
  groceryListForServerSync,
  isManualGroceryInsertCancelled,
  mergeSavedManualGroceryItem,
  rollbackManualGroceryItem,
  trackManualGroceryInsert,
} from '../lib/grocery/manualGroceryInsertLifecycle.ts';
import type { GroceryListItem } from '../types/mealprep.ts';

const item = createManualGroceryItem({ name: 'Zombie tape', quantity: 1, unit: 'each', category: 'dry_goods' });
const saved: GroceryListItem = {
  ...item,
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
};

const coordinator = createManualGroceryInsertCoordinator();
trackManualGroceryInsert(coordinator, item.id);
let grocery: GroceryListItem[] = [item];
cancelManualGroceryInsert(coordinator, item.id);
grocery = grocery.filter((row) => row.id !== item.id);
assert.equal(isManualGroceryInsertCancelled(coordinator, item.id), true);

const afterInsert = mergeSavedManualGroceryItem(grocery, item.id, saved, true);
assert.equal(afterInsert.grocery.length, 0);
assert.equal(afterInsert.shouldDeleteServerId, saved.id);

const keeper = createManualGroceryItem({ name: 'Keep', quantity: 1, unit: 'each', category: 'produce' });
const optimistic = [keeper, item];
const rolledBack = rollbackManualGroceryItem(optimistic, item.id);
assert.equal(rolledBack.length, 1);
assert.equal(rolledBack[0].name, 'Keep');

assert.equal(groceryListForServerSync([item]).length, 0);
assert.equal(groceryListForServerSync([saved]).length, 1);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const appContextSource = fs.readFileSync(path.join(mobileRoot, 'context/AppContext.tsx'), 'utf8');
assert.match(appContextSource, /trackManualGroceryInsert\(pendingManualGroceryInsertsRef\.current, item\.id\)/);
assert.match(appContextSource, /cancelManualGroceryInsert\(pendingManualGroceryInsertsRef\.current, id\)/);
assert.match(appContextSource, /rollbackManualGroceryItem\(prev, item\.id\)/);
assert.match(appContextSource, /throw error instanceof Error \? error : new Error\('Failed to add grocery item'\)/);

console.log('grocery-manual-add-race-check: ok');
