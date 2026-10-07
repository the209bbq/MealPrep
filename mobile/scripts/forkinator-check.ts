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
  FORKINATOR_ASPECT_WIDTH_TO_HEIGHT,
  FORKINATOR_HEIGHT_PX,
  FORKINATOR_POSITION_STORAGE_KEY,
  FORKINATOR_WIDTH_PX,
} from '../lib/forkinator/position';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');

assert.ok(Math.abs(FORKINATOR_ASPECT_WIDTH_TO_HEIGHT - 44 / 120) < 0.001);
assert.equal(FORKINATOR_WIDTH_PX, 44);
assert.equal(FORKINATOR_HEIGHT_PX, 120);

const bounds = {
  width: 390,
  height: 844,
  insetTop: 47,
  insetRight: 0,
  insetBottom: 34,
  insetLeft: 0,
  mascotWidth: FORKINATOR_WIDTH_PX,
  mascotHeight: FORKINATOR_HEIGHT_PX,
};

const defaultPos = defaultForkinatorPosition(bounds);
assert.ok(defaultPos.x > bounds.insetLeft, 'default should dock on the right');
assert.ok(
  defaultPos.x >= bounds.width - bounds.insetRight - bounds.mascotWidth - 12,
  'default x should be near the right edge',
);

const clamped = clampForkinatorPosition({ x: -50, y: 9999 }, bounds);
assert.equal(clamped.x, bounds.insetLeft);
assert.equal(clamped.y, bounds.height - bounds.insetBottom - bounds.mascotHeight);

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
assert.match(overlaySource, /forkinator-full\.png/, 'overlay should use full-body asset');
assert.ok(!overlaySource.includes('forkinator-head'), 'head asset should not be used');
assert.match(overlaySource, /FORKINATOR_WIDTH_PX/, 'overlay should use separate width constant');
assert.match(overlaySource, /FORKINATOR_HEIGHT_PX/, 'overlay should use separate height constant');
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

const assetsDir = path.join(mobileRoot, 'assets/forkinator');
assert.ok(fs.existsSync(path.join(assetsDir, 'forkinator-full.png')), 'full-body asset should exist');
assert.ok(!fs.existsSync(path.join(assetsDir, 'forkinator-head.png')), 'unused head asset should be removed');

console.log('forkinator-check: ok');
