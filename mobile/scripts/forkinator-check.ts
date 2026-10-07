/**
 * Forkinator floating mascot: root overlay, drag position persistence, thinking bubble.
 * Run from mobile/: npm run test:forkinator
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FORKINATOR_ACCESSIBILITY_HINT,
  FORKINATOR_ACCESSIBILITY_LABEL,
} from '../lib/forkinator/a11y';
import {
  FORKINATOR_HIT_HEIGHT_PX,
  FORKINATOR_HIT_INSET_LEFT_PX,
  FORKINATOR_HIT_WIDTH_PX,
} from '../lib/forkinator/hitArea';
import {
  clampForkinatorPosition,
  defaultForkinatorPosition,
  FORKINATOR_ASPECT_WIDTH_TO_HEIGHT,
  FORKINATOR_DEFAULT_BOTTOM_MARGIN_PX,
  FORKINATOR_HEIGHT_PX,
  FORKINATOR_POSITION_STORAGE_KEY,
  FORKINATOR_WIDTH_PX,
} from '../lib/forkinator/position';
import {
  layoutThinkingBubble,
  THINKING_BUBBLE_TAIL_HEIGHT,
} from '../lib/forkinator/thinkingBubbleLayout';
import {
  FORKINATOR_TAP_MOVE_THRESHOLD_PX,
  isForkinatorTapRelease,
} from '../lib/forkinator/tapGesture';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');

assert.ok(Math.abs(FORKINATOR_ASPECT_WIDTH_TO_HEIGHT - 44 / 120) < 0.001);
assert.equal(FORKINATOR_WIDTH_PX, 44);
assert.equal(FORKINATOR_HEIGHT_PX, 120);
assert.equal(THINKING_BUBBLE_TAIL_HEIGHT, 28);

const bounds390 = {
  width: 390,
  height: 844,
  insetTop: 47,
  insetRight: 0,
  insetBottom: 34,
  insetLeft: 0,
  mascotWidth: FORKINATOR_WIDTH_PX,
  mascotHeight: FORKINATOR_HEIGHT_PX,
};

const default390 = defaultForkinatorPosition(bounds390);
assert.ok(default390.x > bounds390.insetLeft, 'default should dock on the right');
assert.ok(
  default390.x >= bounds390.width - bounds390.insetRight - bounds390.mascotWidth - 12,
  'default x should be near the right edge',
);
const expectedDefaultY390 =
  bounds390.height -
  bounds390.insetBottom -
  bounds390.mascotHeight -
  FORKINATOR_DEFAULT_BOTTOM_MARGIN_PX;
assert.equal(default390.y, expectedDefaultY390, 'default should sit above the tab bar');
assert.ok(
  default390.y > 500,
  'default should be in the lower screen (avoids mid-screen controls)',
);

const bounds320 = {
  width: 320,
  height: 568,
  insetTop: 44,
  insetRight: 0,
  insetBottom: 28,
  insetLeft: 0,
  mascotWidth: FORKINATOR_WIDTH_PX,
  mascotHeight: FORKINATOR_HEIGHT_PX,
};
const default320 = defaultForkinatorPosition(bounds320);
assert.ok(
  default320.y >
    bounds320.insetTop +
      (bounds320.height - bounds320.insetTop - bounds320.insetBottom) * 0.55,
  '320px default should sit low on the screen',
);

const clamped = clampForkinatorPosition({ x: -50, y: 9999 }, bounds390);
assert.equal(clamped.x, bounds390.insetLeft);
assert.equal(clamped.y, bounds390.height - bounds390.insetBottom - bounds390.mascotHeight);

assert.equal(FORKINATOR_POSITION_STORAGE_KEY, 'mealprep.forkinator.position');
assert.equal(FORKINATOR_ACCESSIBILITY_LABEL, 'Forkinator');
assert.equal(FORKINATOR_ACCESSIBILITY_HINT, 'Tap to show thinking bubble');

assert.ok(FORKINATOR_HIT_WIDTH_PX < FORKINATOR_WIDTH_PX, 'hit area narrower than asset');
assert.ok(FORKINATOR_HIT_HEIGHT_PX < FORKINATOR_HEIGHT_PX, 'hit area shorter than asset');
assert.ok(FORKINATOR_HIT_INSET_LEFT_PX > 0, 'hit area aligned toward the fork body');

assert.equal(FORKINATOR_TAP_MOVE_THRESHOLD_PX, 6);
assert.equal(isForkinatorTapRelease(0, 0, 200), true);
assert.equal(isForkinatorTapRelease(5.9, 0, 200), true);
assert.equal(isForkinatorTapRelease(6, 0, 200), false);
assert.equal(isForkinatorTapRelease(0, 0, 500), false);
assert.equal(isForkinatorTapRelease(10, 0, 200), false, '10px move is a drag, not a tap');

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
assert.equal(
  aboveLayout.top,
  200 - aboveLayout.height - 6,
  'bubble should respect mascot gap with corrected tail height',
);

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
assert.match(overlaySource, /accessibilityRole="button"/);
assert.match(overlaySource, /accessibilityHint=\{FORKINATOR_ACCESSIBILITY_HINT\}/);
assert.match(overlaySource, /forkinatorDragSurfaceWebStyle/, 'web drag surface should disable browser gestures');
assert.match(overlaySource, /draggable: false/, 'mascot image should not be natively draggable on web');
assert.match(overlaySource, /onPointerDown/, 'web should use pointer events for drag');
assert.match(overlaySource, /FORKINATOR_HIT_WIDTH_PX/, 'touch target should use reduced hit area');
assert.match(overlaySource, /onKeyDown/, 'web keyboard should toggle bubble');
assert.match(overlaySource, /tabIndex: 0/, 'web mascot should be focusable');
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
assert.match(bubbleSource, /USE_NATIVE_DRIVER/, 'bubble should gate native driver on web');
assert.ok(!bubbleSource.includes('tip'), 'bubble should not include tip copy');

const accountSource = fs.readFileSync(path.join(mobileRoot, 'components/account/AccountSheet.tsx'), 'utf8');
assert.ok(!/Forkinator/i.test(accountSource), 'Account settings should not include Forkinator toggle');

const libForkinatorDir = path.join(mobileRoot, 'lib/forkinator');
assert.ok(fs.existsSync(path.join(libForkinatorDir, 'position.ts')), 'position helpers should exist');
assert.ok(fs.existsSync(path.join(libForkinatorDir, 'hitArea.ts')), 'hit area helpers should exist');
assert.ok(!fs.existsSync(path.join(libForkinatorDir, 'engine.ts')), 'tip engine should not exist');

const assetsDir = path.join(mobileRoot, 'assets/forkinator');
assert.ok(fs.existsSync(path.join(assetsDir, 'forkinator-full.png')), 'full-body asset should exist');

console.log('forkinator-check: ok');
