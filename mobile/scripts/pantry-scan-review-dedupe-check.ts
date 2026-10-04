/**
 * Pantry scan review: filter detections already in pantry + merge behavior.
 * Run from mobile/: npm run test:pantry-scan-review
 */
import assert from 'node:assert/strict';
import type { PantryItem } from '../types/mealprep';
import {
  detectionsToReviewItems,
  filterDetectionsNotAlreadyInPantry,
  mergeSecondScanIntoReview,
} from '../lib/pantryVision/reviewItems';
import type { PantryVisionDetection } from '../lib/pantryVision/types';

const pantry: PantryItem[] = [
  {
    id: 'p1',
    ingredientId: 'egg',
    name: 'Eggs',
    category: 'dairy',
    quantity: 6,
    unit: 'each',
    location: 'fridge',
    photoUri: null,
    scanPhotoPath: null,
    expiresOn: null,
    updatedAt: '',
  },
];

const eggsDetection: PantryVisionDetection = {
  name: 'eggs',
  quantity: 12,
  unit: 'each',
  category: 'dairy',
  confidence: 0.9,
};

const milkDetection: PantryVisionDetection = {
  name: 'milk',
  quantity: 1,
  unit: 'gallon',
  category: 'dairy',
  confidence: 0.88,
};

const filtered = filterDetectionsNotAlreadyInPantry([eggsDetection, milkDetection], pantry);
assert.equal(filtered.length, 1, 'drops eggs already in pantry');
assert.equal(filtered[0].name, 'milk');

const reviewRows = detectionsToReviewItems([eggsDetection, milkDetection], pantry, [], null, false, 'fridge');
assert.equal(reviewRows.length, 1, 'review rows skip pantry duplicates');
assert.ok(reviewRows[0].name.toLowerCase().includes('milk'));

const firstPass = detectionsToReviewItems([milkDetection], [], [], null, false, 'pantry');
const merged = mergeSecondScanIntoReview(firstPass, [eggsDetection], pantry, [], 'pantry');
assert.equal(merged.length, 1, 'second photo does not re-add eggs when already in pantry');

console.log('OK: pantry scan review dedupe checks passed');
