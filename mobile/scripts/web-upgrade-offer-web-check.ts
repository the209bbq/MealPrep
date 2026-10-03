/**
 * Ensures Plus upgrade copy stays enabled on web (Android-only gate must not affect web export).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLANS_COPY } from '../config/plans.ts';
import { UPGRADE_OFFER_CONFIG } from '../config/upgradeOffer.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entry = fs.readFileSync(
  path.join(__dirname, '../lib/platform/shouldShowUpgradeOffer.ts'),
  'utf8',
);

assert.equal(UPGRADE_OFFER_CONFIG.androidVisible, false);
assert.match(entry, /Platform\.OS === 'android'/);
assert.ok(PLANS_COPY.photoScanUpgradeBody.includes('Upgrade'));

const webShim = fs.readFileSync(path.join(__dirname, '../lib/icons/Ionicons.web.ts'), 'utf8');
assert.match(webShim, /HydrationSafeIonicon/);

console.log('web-upgrade-offer-web-check: ok');
