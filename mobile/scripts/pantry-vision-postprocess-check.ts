/**
 * Pantry vision parsing / dedupe determinism checks.
 * Run from mobile/: npm run test:pantry-vision
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  dedupeDetections,
  mergeDetectionPasses,
  parsePantryVisionPayload,
} from '../lib/pantryVision/detectionParse';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(scriptDir, '../test-fixtures/pantry-vision-sample.json');

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

const raw = JSON.parse(readFileSync(fixturePath, 'utf8'));

const first = parsePantryVisionPayload(raw);
const second = parsePantryVisionPayload(raw);
assert(stableJson(first) === stableJson(second), 'parsePantryVisionPayload must be deterministic');

const deduped = dedupeDetections(first);
assert(deduped.some((r) => r.name.toLowerCase().includes('tomato')), 'merged tomato soup rows');
assert(deduped.length < first.length, 'dedupe should collapse duplicates');

const passB = parsePantryVisionPayload({
  items: [
    {
      name: 'Olive Oil',
      quantity: 1,
      unit: 'bottle',
      category: 'condiments',
      storage: 'pantry',
      confidence: 0.86,
    },
  ],
});
const merged = mergeDetectionPasses(deduped, passB);
assert(merged.length === deduped.length + 1, 'merge pass should add olive oil');

const mergedAgain = mergeDetectionPasses(deduped, passB);
assert(stableJson(merged) === stableJson(mergedAgain), 'mergeDetectionPasses must be deterministic');

console.log('OK: pantry-vision post-process checks passed');
