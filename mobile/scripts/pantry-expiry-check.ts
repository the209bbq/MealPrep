/**
 * Pantry expiry label helpers.
 * Run from mobile/: npm run test:pantry-expiry
 */

import assert from 'node:assert/strict';
import { isExpiringSoon, isPantryItemExpired } from '../lib/pantry/expiry';

const breadOct10 = { expiresOn: '2026-10-10' };
const milkOct12 = { expiresOn: '2026-10-12' };
const sunday = new Date('2026-10-11T12:00:00Z');

assert.equal(isPantryItemExpired(breadOct10, sunday), true, 'Oct 10 bread expired on Oct 11');
assert.equal(isExpiringSoon(breadOct10, 7, sunday), false, 'expired item is not expiring soon');
assert.equal(isPantryItemExpired(milkOct12, sunday), false, 'Oct 12 milk not expired on Oct 11');
assert.equal(isExpiringSoon(milkOct12, 7, sunday), true, 'Oct 12 milk expiring soon on Oct 11');

console.log('pantry-expiry-check: ok');
