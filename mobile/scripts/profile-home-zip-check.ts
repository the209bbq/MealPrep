/**
 * Profile home ZIP validation + ZCTA nearest lookup (profile setup / onboarding).
 */
import assert from 'node:assert/strict';
import {
  formatHomeZipInput,
  validateOptionalHomeZip,
} from '../lib/profile/homeZip.ts';
import { nearestZctaZip } from '../lib/stores/zctaCentroids.ts';

assert.equal(formatHomeZipInput('95-361a'), '95361');
assert.equal(formatHomeZipInput('1234567890'), '12345');

assert.deepEqual(validateOptionalHomeZip(''), { ok: true, zip: '' });
assert.deepEqual(validateOptionalHomeZip('95361'), { ok: true, zip: '95361' });
assert.equal(validateOptionalHomeZip('1234').ok, false);
assert.equal(validateOptionalHomeZip('abcde').ok, false);

void nearestZctaZip(37.7665, -120.8471).then((zip) => {
  assert.equal(zip, '95361', 'nearest ZCTA near Oakdale test coords');
  console.log('profile-home-zip-check: ok');
});
