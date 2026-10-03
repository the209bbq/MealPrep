/**
 * Pantry vision region crop planning checks.
 * Run from mobile/: npm run test:pantry-vision-regions
 */
import assert from 'node:assert/strict';
import {
  planPantryRegionSpecs,
  readImageDimensions,
} from '../supabase/functions/pantry-vision/pantryImageRegions';

assert.equal(planPantryRegionSpecs(800, 1200).length >= 2, true, 'tall shelf gets upper/lower crops');
assert.equal(
  planPantryRegionSpecs(800, 1200).some((r) => r.id === 'lower'),
  true,
  'tall shelf includes lower half',
);

const wide = planPantryRegionSpecs(1600, 900);
assert.equal(wide.length >= 2, true, 'wide shelf gets left/right crops');
assert.equal(wide.some((r) => r.id === 'left' || r.id === 'right'), true, 'wide shelf splits horizontally');

assert.equal(planPantryRegionSpecs(40, 40).length, 0, 'tiny images skip regions');

const pngHeader = new Uint8Array(24);
pngHeader[0] = 0x89;
pngHeader[1] = 0x50;
pngHeader[2] = 0x4e;
pngHeader[3] = 0x47;
pngHeader[16] = 0;
pngHeader[17] = 0;
pngHeader[18] = 0x03;
pngHeader[19] = 0x20; // 800
pngHeader[20] = 0;
pngHeader[21] = 0;
pngHeader[22] = 0x04;
pngHeader[23] = 0xb0; // 1200
const dims = readImageDimensions(pngHeader, 'image/png');
assert.equal(dims?.width, 800);
assert.equal(dims?.height, 1200);

console.log('OK: pantry-vision region checks passed');
