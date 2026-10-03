/**
 * Pantry vision second-pass (add-missing) policy checks.
 * Run from mobile/: npm run test:pantry-vision-second-pass
 */
import assert from 'node:assert/strict';
import { shouldRunPantryVerifySecondPass } from '../config/pantryVisionScan';
import { shouldRunPantryVerifySecondPass as mergeShouldRun } from '../lib/pantryVision/pantryItemMerge';

assert.equal(shouldRunPantryVerifySecondPass(false), true, 'run verify pass when budget remains');
assert.equal(shouldRunPantryVerifySecondPass(true), false, 'skip verify pass when budget exhausted');
assert.equal(mergeShouldRun(false), true, 'client merge helper matches scan config');
assert.equal(mergeShouldRun(true), false, 'client merge helper matches scan config');

console.log('OK: pantry-vision second-pass checks passed');
