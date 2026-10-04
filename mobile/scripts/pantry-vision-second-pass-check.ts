/**
 * Pantry vision second-pass (add-missing) policy checks.
 * Run from mobile/: npm run test:pantry-vision-second-pass
 */
import assert from 'node:assert/strict';
import { shouldRunPantryVerifySecondPass } from '../config/pantryVisionScan';
import { shouldRunPantryVerifySecondPass as mergeShouldRun } from '../lib/pantryVision/pantryItemMerge';

assert.equal(shouldRunPantryVerifySecondPass(false), false, 'single Gemini call per photo');
assert.equal(shouldRunPantryVerifySecondPass(true), false, 'never run verify second pass');
assert.equal(mergeShouldRun(false), false, 'client merge helper matches scan config');
assert.equal(mergeShouldRun(true), false, 'client merge helper matches scan config');

console.log('OK: pantry-vision second-pass checks passed');
