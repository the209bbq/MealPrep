/**
 * Web image picker must not auto-cancel while the OS picker is still open.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const pickPath = path.join(__dirname, '../lib/web/pickWebImageFile.ts');
const source = fs.readFileSync(pickPath, 'utf8');

assert.ok(!source.includes('pollForSelectionAfterDismiss(0), 400'), 'no early 400ms cancel poll');
assert.ok(source.includes("'cancel'"), 'listens for input cancel');
assert.ok(source.includes("'blur'"), 'waits for window blur before dismiss polling');

console.log('web-pick-image-check: ok');
