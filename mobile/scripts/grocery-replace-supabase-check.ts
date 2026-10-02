/**
 * Supabase grocery persistence must never send client ephemeral ids as uuid primary keys.
 * Run from mobile/: npm run test:grocery-replace-supabase
 */

import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildGroceryList } from '../lib/grocery';
import { isPersistedGroceryUuid } from '../lib/grocery/persistIds';
import { insertGroceryItem, replaceGroceryList } from '../lib/supabaseData';
import type { GroceryListItem, Recipe } from '../types/mealprep';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const EXISTING_ID = '22222222-2222-4222-8222-222222222222';
const REMOVED_ID = '33333333-3333-4333-8333-333333333333';
const INSERTED_ID = '44444444-4444-4444-8444-444444444444';

type GroceryDbRow = {
  id: string;
  user_id: string;
  ingredient_id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  checked: boolean;
  source_recipe_ids: string[] | null;
};

interface RecordedWrite {
  op: 'upsert' | 'insert' | 'delete';
  rows: unknown;
  deleteIds?: string[];
}

function assertNoNonUuidRowIds(rows: unknown, context: string): void {
  const list = Array.isArray(rows) ? rows : [rows];
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    if (!('id' in record)) continue;
    const id = record.id;
    assert(typeof id === 'string', `${context}: id must be string`);
    assert(isPersistedGroceryUuid(id), `${context}: non-uuid id sent to Supabase: ${id}`);
  }
}

function createMockClient(initialRows: GroceryDbRow[]): {
  client: SupabaseClient;
  writes: RecordedWrite[];
  rows: GroceryDbRow[];
} {
  const writes: RecordedWrite[] = [];
  let rows = [...initialRows];

  const client = {
    from(table: string) {
      assert.equal(table, 'grocery_list_items');
      return {
        select() {
          return {
            eq(_col: string, userId: string) {
              assert.equal(userId, USER_ID);
              return Promise.resolve({ data: rows, error: null });
            },
            order() {
              return this;
            },
          };
        },
        delete() {
          return {
            eq(_col: string, userId: string) {
              return {
                in(_idCol: string, ids: string[]) {
                  writes.push({ op: 'delete', rows: null, deleteIds: ids });
                  rows = rows.filter((row) => !ids.includes(row.id));
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
        upsert(payload: unknown) {
          writes.push({ op: 'upsert', rows: payload });
          assertNoNonUuidRowIds(payload, 'upsert');
          const incoming = Array.isArray(payload) ? payload : [payload];
          const updated: GroceryDbRow[] = [];
          for (const raw of incoming) {
            const patch = raw as GroceryDbRow;
            const index = rows.findIndex((row) => row.id === patch.id);
            const merged = index >= 0 ? { ...rows[index], ...patch } : { ...patch };
            if (index >= 0) rows[index] = merged;
            else rows.push(merged);
            updated.push(merged);
          }
          return {
            select() {
              return Promise.resolve({ data: updated, error: null });
            },
          };
        },
        insert(payload: unknown) {
          writes.push({ op: 'insert', rows: payload });
          const incoming = Array.isArray(payload) ? payload : [payload];
          for (const row of incoming) {
            assert(
              !row || typeof row !== 'object' || !('id' in (row as object)),
              'insert must not include client id',
            );
          }
          const inserted = incoming.map((raw, index) => {
            const patch = raw as Omit<GroceryDbRow, 'id'>;
            const created: GroceryDbRow = {
              id: index === 0 ? INSERTED_ID : `${INSERTED_ID.slice(0, -1)}${index}`,
              ...patch,
              source_recipe_ids: patch.source_recipe_ids ?? [],
            };
            rows.push(created);
            return created;
          });
          return {
            select() {
              const listResult = Promise.resolve({ data: inserted, error: null });
              return {
                single() {
                  return Promise.resolve({ data: inserted[0], error: null });
                },
                then(
                  onFulfilled?: (value: { data: GroceryDbRow[]; error: null }) => unknown,
                  onRejected?: (reason: unknown) => unknown,
                ) {
                  return listResult.then(onFulfilled, onRejected);
                },
              };
            },
          };
        },
        update(patch: unknown) {
          return {
            eq(col: string, id: string) {
              return {
                eq() {
                  const row = rows.find((r) => r.id === id);
                  assert(row, 'update target should exist');
                  Object.assign(row, patch);
                  return {
                    select() {
                      return {
                        single() {
                          return Promise.resolve({ data: row, error: null });
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  return { client, writes, getRows: () => rows };
}

async function main(): Promise<void> {
const recipe: Recipe = {
  id: 'lemon-chicken',
  name: 'Lemon Chicken',
  tag: '',
  description: '',
  servings: 4,
  minutes: 30,
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  ingredients: [
    { name: 'Limes', ingredientId: 'limes', quantity: 2, unit: 'each' },
    { name: 'Chicken breast', ingredientId: 'chicken-breast', quantity: 1, unit: 'lb' },
  ],
  steps: [],
  isMaster: true,
  createdAt: '',
};

const existingRows: GroceryDbRow[] = [
  {
    id: EXISTING_ID,
    user_id: USER_ID,
    ingredient_id: 'limes',
    name: 'Limes',
    category: 'produce',
    quantity: 1,
    unit: 'each',
    checked: false,
    source_recipe_ids: ['lemon-chicken'],
  },
  {
    id: REMOVED_ID,
    user_id: USER_ID,
    ingredient_id: 'milk',
    name: 'Milk',
    category: 'dairy',
    quantity: 1,
    unit: 'gal',
    checked: false,
    source_recipe_ids: [],
  },
];

const mock = createMockClient(existingRows);

const built = buildGroceryList([recipe], ['lemon-chicken'], [], {}, [], {});
assert.ok(built.some((row) => row.id.startsWith('groc-')), 'built list should use ephemeral ids');

const nextList: GroceryListItem[] = [
  {
    id: EXISTING_ID,
    ingredientId: 'limes',
    name: 'Limes',
    category: 'produce',
    quantity: 3,
    unit: 'each',
    checked: true,
    sourceRecipeIds: ['lemon-chicken'],
  },
  ...built.filter((row) => row.name !== 'Limes'),
];

const persisted = await replaceGroceryList(mock.client, USER_ID, nextList);
assert.equal(persisted.length, 2);
assert.ok(persisted.every((row) => isPersistedGroceryUuid(row.id)));

const deleteWrite = mock.writes.find((w) => w.op === 'delete');
assert.ok(deleteWrite?.deleteIds?.includes(REMOVED_ID), 'stale row should be deleted');

const upsertWrite = mock.writes.find((w) => w.op === 'upsert');
assert.ok(upsertWrite, 'existing row should be upserted with uuid');
assertNoNonUuidRowIds(upsertWrite.rows, 'upsert after replace');

const insertWrite = mock.writes.find((w) => w.op === 'insert');
assert.ok(insertWrite, 'new built row should bulk insert without id');

const insertMock = createMockClient([]);
const manualItem: GroceryListItem = {
  id: 'manual-1234567890-towels',
  ingredientId: 'manual-towels-123',
  name: 'Paper towels',
  category: 'dry_goods',
  quantity: 1,
  unit: 'each',
  checked: false,
  sourceRecipeIds: [],
};
const inserted = await insertGroceryItem(insertMock.client, USER_ID, manualItem);
assert.ok(isPersistedGroceryUuid(inserted.id));
const manualInsert = insertMock.writes.find((w) => w.op === 'insert');
assert.ok(manualInsert);
const manualRows = Array.isArray(manualInsert.rows) ? manualInsert.rows : [manualInsert.rows];
for (const row of manualRows) {
  assert.ok(!row || typeof row !== 'object' || !('id' in (row as object)));
}

console.log('grocery-replace-supabase-check: ok');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
