/**
 * Pantry header “Add staples” chip: catalog preview icons, navigation, sizing.
 * Run from mobile/: npm run test:pantry-staples-link
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_ROUTES } from '../config/appRoutes.ts';
import {
  PANTRY_STAPLES_LINK_PREVIEW_IDS,
  getStapleById,
  stapleLinkPreviewEntries,
} from '../lib/pantry/stapleCatalog.ts';

assert.equal(APP_ROUTES.pantryStaples, '/pantry-staples');

for (const id of PANTRY_STAPLES_LINK_PREVIEW_IDS) {
  assert.ok(getStapleById(id), `preview staple missing from catalog: ${id}`);
}

const preview = stapleLinkPreviewEntries();
assert.equal(preview.length, PANTRY_STAPLES_LINK_PREVIEW_IDS.length);
assert.ok(preview.every((row) => row.emoji.length > 0), 'preview rows should expose catalog emoji');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');

const linkSource = fs.readFileSync(
  path.join(mobileRoot, 'components/pantry/PantryAddStaplesLink.tsx'),
  'utf8',
);
assert.match(linkSource, /stapleLinkPreviewEntries/, 'link should resolve icons from staple catalog');
assert.match(linkSource, /PANTRY_STAPLES_COPY\.addStaplesLink/);
assert.doesNotMatch(linkSource, /text-xs/, 'add staples label should not use text-xs');
assert.match(linkSource, /accessibilityLabel/);
assert.match(linkSource, /Add staples like/, 'a11y label should mention sample staples');

const pantrySource = fs.readFileSync(path.join(mobileRoot, 'app/(tabs)/pantry.tsx'), 'utf8');
assert.match(pantrySource, /<PantryAddStaplesLink onPress=\{openPantryStaples\}/);
assert.match(pantrySource, /function openPantryStaples\(\)/);
assert.match(
  pantrySource,
  /router\.push\(APP_ROUTES\.pantryStaples\)/,
  'openPantryStaples should route to pantry staples screen',
);
assert.doesNotMatch(
  pantrySource,
  /text-xs font-bold text-primary-dark">\{PANTRY_STAPLES_COPY\.addStaplesLink\}/,
  'pantry screen should not render the old xs link',
);

console.log('pantry-staples-link-check: ok');
