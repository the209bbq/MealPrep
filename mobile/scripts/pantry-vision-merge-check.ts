/**
 * Pantry vision merge/dedupe checks (max quantity, no summing across passes).
 * Run from mobile/: npm run test:pantry-vision-merge
 */

import {
  dedupePantryRows,
  mergePantryPasses,
  type PantryMergeRow,
} from '../lib/pantryVision/pantryItemMerge';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const identity = {
  identityKey: (name: string) => name.toLowerCase().trim(),
  rowsMatch: (a: string, b: string) => a.toLowerCase() === b.toLowerCase(),
};

const row = (name: string, quantity: number): PantryMergeRow => ({
  name,
  quantity,
  unit: 'can',
  confidence: 0.9,
});

const mergedPass = mergePantryPasses(
  [row('tomato soup', 2)],
  [row('tomato soup', 2)],
  identity,
);
assert(mergedPass.length === 1, 'duplicate names collapse');
assert(mergedPass[0].quantity === 2, 'duplicate passes must not sum quantities');

const deduped = dedupePantryRows([row('black olives', 1), row('black olives', 3)], identity);
assert(deduped[0].quantity === 3, 'dedupe takes max quantity');

console.log('OK: pantry vision merge checks passed');
