/**
 * Forkinator floating mascot: root overlay, drag position persistence, no motion animations.
 * Run from mobile/: npm run test:forkinator
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clampForkinatorPosition,
  defaultForkinatorPosition,
  FORKINATOR_POSITION_STORAGE_KEY,
  FORKINATOR_SIZE_PX,
} from '../lib/forkinator/position';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');

const bounds = {
  width: 390,
  height: 844,
  insetTop: 47,
  insetRight: 0,
  insetBottom: 34,
  insetLeft: 0,
  size: FORKINATOR_SIZE_PX,
};

const defaultPos = defaultForkinatorPosition(bounds);
assert.ok(defaultPos.x > bounds.insetLeft, 'default should dock on the right');
assert.ok(
  defaultPos.x >= bounds.width - bounds.insetRight - bounds.size - 12,
  'default x should be near the right edge',
);

const clamped = clampForkinatorPosition({ x: -50, y: 9999 }, bounds);
assert.equal(clamped.x, bounds.insetLeft);
assert.equal(clamped.y, bounds.height - bounds.insetBottom - bounds.size);

assert.equal(FORKINATOR_POSITION_STORAGE_KEY, 'mealprep.forkinator.position');

const overlaysSource = fs.readFileSync(path.join(mobileRoot, 'components/AppOverlays.tsx'), 'utf8');
assert.match(overlaysSource, /ForkinatorOverlay/, 'Forkinator should mount from AppOverlays');
assert.match(overlaysSource, /pointerEvents="box-none"/, 'overlay root should not steal touches');

const forkinatorDir = path.join(mobileRoot, 'components/forkinator');
const forkinatorFiles = fs.readdirSync(forkinatorDir).filter((name) => name.endsWith('.tsx'));
for (const file of forkinatorFiles) {
  const source = fs.readFileSync(path.join(forkinatorDir, file), 'utf8');
  assert.ok(!source.includes('Animated'), `${file} should not use Animated`);
  assert.ok(!source.includes('.spring('), `${file} should not use spring animations`);
  assert.ok(!source.includes('.timing('), `${file} should not use timing animations`);
}

const overlaySource = fs.readFileSync(path.join(forkinatorDir, 'ForkinatorOverlay.tsx'), 'utf8');
assert.match(overlaySource, /readForkinatorPosition/, 'overlay should restore saved position');
assert.match(overlaySource, /writeForkinatorPosition/, 'overlay should persist position on release');
assert.match(overlaySource, /pointerEvents="box-none"/, 'Forkinator overlay wrapper passes touches through');
assert.match(overlaySource, /accessibilityLabel="Forkinator"/);
assert.match(overlaySource, /PanResponder/, 'Forkinator should be draggable');
assert.ok(!overlaySource.includes('Keyboard'), 'Forkinator should not hide for keyboard');
assert.ok(!overlaySource.includes('showForkinator'), 'Forkinator should always render');

const accountSource = fs.readFileSync(path.join(mobileRoot, 'components/account/AccountSheet.tsx'), 'utf8');
assert.ok(!/Forkinator/i.test(accountSource), 'Account settings should not include Forkinator toggle');

const libForkinatorDir = path.join(mobileRoot, 'lib/forkinator');
assert.ok(fs.existsSync(path.join(libForkinatorDir, 'position.ts')), 'position helpers should exist');
assert.ok(!fs.existsSync(path.join(libForkinatorDir, 'engine.ts')), 'tip engine removed from this PR');

console.log('forkinator-check: ok');
