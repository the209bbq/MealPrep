/**
 * Profile home ZIP validation (profile setup / onboarding). No ZCTA table — Stores tab only.
 */
import assert from 'node:assert/strict';
import {
  formatHomeZipInput,
  validateOptionalHomeZip,
} from '../lib/profile/homeZip.ts';

assert.equal(formatHomeZipInput('95-361a'), '95361');
assert.equal(formatHomeZipInput('1234567890'), '12345');

assert.deepEqual(validateOptionalHomeZip(''), { ok: true, zip: '' });
assert.deepEqual(validateOptionalHomeZip('95361'), { ok: true, zip: '95361' });
assert.equal(validateOptionalHomeZip('1234').ok, false);
assert.equal(validateOptionalHomeZip('abcde').ok, false);

console.log('profile-home-zip-check: ok');
