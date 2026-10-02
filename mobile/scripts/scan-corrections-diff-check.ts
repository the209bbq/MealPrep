/**
 * Scan correction diff (rename / removed / added).
 * Run from mobile/: npx tsx scripts/scan-corrections-diff-check.ts
 */

import { buildScanCorrectionRows, countScanCorrectionsByKind } from '../lib/scanCorrections/diff';
import type { PantryScanReviewItem } from '../lib/pantryVision/types';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function reviewItem(partial: Partial<PantryScanReviewItem> & Pick<PantryScanReviewItem, 'key' | 'name'>): PantryScanReviewItem {
  return {
    key: partial.key,
    enabled: partial.enabled ?? true,
    name: partial.name,
    quantity: partial.quantity ?? 1,
    unit: partial.unit ?? 'each',
    category: partial.category ?? 'dry_goods',
    confidence: partial.confidence ?? 0.9,
    ingredientId: partial.ingredientId ?? 'test',
    location: partial.location ?? 'pantry',
    photoUri: null,
    isDemoSample: false,
    sourceAiName: partial.sourceAiName ?? null,
    addedManually: partial.addedManually ?? false,
  };
}

const baseline = new Map([
  ['a', { aiName: 'Tomato soup' }],
  ['b', { aiName: 'Black beans' }],
]);

const renamed = buildScanCorrectionRows({
  scanId: 'scan-1',
  model: 'gemini-test',
  baseline,
  trainingPhotoPath: null,
  finalItems: [
    reviewItem({ key: 'a', name: 'Tomato bisque', sourceAiName: 'Tomato soup' }),
    reviewItem({ key: 'b', name: 'Black beans', enabled: false, sourceAiName: 'Black beans' }),
    reviewItem({
      key: 'c',
      name: 'Olive oil',
      addedManually: true,
      sourceAiName: null,
    }),
  ],
});

const counts = countScanCorrectionsByKind(renamed);
assert(counts.rename === 1, 'expects one rename');
assert(counts.removed === 1, 'expects one removed');
assert(counts.added === 1, 'expects one added');
assert(
  renamed.some((row) => row.kind === 'rename' && row.ai_name === 'Tomato soup' && row.user_name === 'Tomato bisque'),
  'rename row content',
);

const mergedAway = buildScanCorrectionRows({
  scanId: 'scan-2',
  model: null,
  baseline: new Map([['gone', { aiName: 'Stale croutons' }]]),
  trainingPhotoPath: '/uid/pantry/x.jpg',
  finalItems: [],
});
assert(mergedAway.length === 1 && mergedAway[0].kind === 'removed', 'missing final row logs removed');

console.log('OK: scan corrections diff checks passed');
