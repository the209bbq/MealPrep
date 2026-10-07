/**
 * Forkinator floating mascot: root overlay, drag position persistence, thinking bubble.
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
import { layoutThinkingBubble } from '../lib/forkinator/thinkingBubbleLayout';
import {
  FORKINATOR_TAP_MOVE_THRESHOLD_PX,
  isForkinatorTapRelease,
} from '../lib/forkinator/tapGesture';

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

assert.equal(FORKINATOR_TAP_MOVE_THRESHOLD_PX, 6);
assert.equal(isForkinatorTapRelease(0, 0, 200), true);
assert.equal(isForkinatorTapRelease(5.9, 0, 200), true);
assert.equal(isForkinatorTapRelease(6, 0, 200), false);
assert.equal(isForkinatorTapRelease(0, 0, 500), false);

const aboveLayout = layoutThinkingBubble({
  mascotX: 200,
  mascotY: 200,
  mascotWidth: FORKINATOR_WIDTH_PX,
  mascotHeight: FORKINATOR_HEIGHT_PX,
  screenWidth: 390,
  screenHeight: 844,
  insetTop: 47,
  insetRight: 0,
  insetBottom: 34,
  insetLeft: 0,
});
assert.equal(aboveLayout.placement, 'above');
assert.ok(aboveLayout.top < 200, 'bubble should sit above mascot when room allows');

const belowLayout = layoutThinkingBubble({
  mascotX: 200,
  mascotY: 50,
  mascotWidth: FORKINATOR_WIDTH_PX,
  mascotHeight: FORKINATOR_HEIGHT_PX,
  screenWidth: 390,
  screenHeight: 844,
  insetTop: 47,
  insetRight: 0,
  insetBottom: 34,
  insetLeft: 0,
});
assert.equal(belowLayout.placement, 'below');
assert.ok(belowLayout.top > 50, 'bubble should flip below when not enough space above');

const overlaysSource = fs.readFileSync(path.join(mobileRoot, 'components/AppOverlays.tsx'), 'utf8');
assert.match(overlaysSource, /ForkinatorOverlay/, 'Forkinator should mount from AppOverlays');
assert.match(overlaysSource, /pointerEvents="box-none"/, 'overlay root should not steal touches');

const forkinatorDir = path.join(mobileRoot, 'components/forkinator');
const overlaySource = fs.readFileSync(path.join(forkinatorDir, 'ForkinatorOverlay.tsx'), 'utf8');
assert.match(overlaySource, /forkinator-full\.png/, 'overlay should use full-body asset');
assert.match(overlaySource, /readForkinatorPosition/, 'overlay should restore saved position');
assert.match(overlaySource, /writeForkinatorPosition/, 'overlay should persist position on release');
assert.match(overlaySource, /pointerEvents="box-none"/, 'Forkinator overlay wrapper passes touches through');
assert.match(overlaySource, /accessibilityLabel="Forkinator"/);
assert.match(overlaySource, /PanResponder/, 'Forkinator should be draggable');
assert.match(overlaySource, /isForkinatorTapRelease/, 'tap should use movement threshold helper');
assert.match(overlaySource, /setThinkingVisible/, 'tap should toggle thinking bubble');
assert.ok(!overlaySource.includes('Animated'), 'mascot overlay should stay unanimated');

const bubbleSource = fs.readFileSync(
  path.join(forkinatorDir, 'ForkinatorThinkingBubble.tsx'),
  'utf8',
);
assert.match(bubbleSource, /Animated/, 'thinking bubble may animate');
assert.match(bubbleSource, /pointerEvents="none"/, 'bubble should pass touches through');
assert.match(bubbleSource, /reduceMotion/, 'bubble should respect reduce motion');
assert.ok(!bubbleSource.includes('tip'), 'bubble should not include tip copy');

const accountSource = fs.readFileSync(path.join(mobileRoot, 'components/account/AccountSheet.tsx'), 'utf8');
assert.ok(!/Forkinator/i.test(accountSource), 'Account settings should not include Forkinator toggle');

const libForkinatorDir = path.join(mobileRoot, 'lib/forkinator');
assert.ok(fs.existsSync(path.join(libForkinatorDir, 'position.ts')), 'position helpers should exist');
assert.ok(!fs.existsSync(path.join(libForkinatorDir, 'engine.ts')), 'tip engine should not exist');

const assetsDir = path.join(mobileRoot, 'assets/forkinator');
assert.ok(fs.existsSync(path.join(assetsDir, 'forkinator-full.png')), 'full-body asset should exist');

console.log('forkinator-check: ok');
