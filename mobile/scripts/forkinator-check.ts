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
  FORKINATOR_HAS_SCANNED_STORAGE_KEY,
  markForkinatorPantryScanCompleted,
  readForkinatorHasScanned,
  writeForkinatorHasScanned,
} from '../lib/forkinator/hasScanned';
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
  FORKINATOR_GREETING_AUTO_HIDE_MS,
  FORKINATOR_GREETING_AUTO_SHOW_DELAY_MS,
  FORKINATOR_GREETING_SHOWN_STORAGE_KEY,
  forkinatorPromptSessionPlan,
  markForkinatorGreetingShown,
  readForkinatorGreetingShown,
  shouldAutoShowForkinatorGreeting,
} from '../lib/forkinator/greetingShown';
import {
  FORKINATOR_GREETING_A11Y_LABEL,
  FORKINATOR_GREETING_MESSAGE,
  FORKINATOR_SCANNER_NUDGE_MESSAGE,
} from '../lib/forkinator/scannerNudgeCopy';
import {
  FORKINATOR_SCANNER_NUDGE_COOLDOWN_MS,
  FORKINATOR_SCANNER_NUDGE_LAST_SHOWN_STORAGE_KEY,
  FORKINATOR_SCANNER_PROMPT_AUTO_SHOW_DELAY_MS,
  resolveForkinatorMascotTapAction,
  shouldAutoShowForkinatorScannerPrompt,
  writeForkinatorScannerNudgeLastShownAt,
} from '../lib/forkinator/scannerNudgeCooldown';
import {
  layoutScannerPrompt,
  scannerPromptBodySize,
} from '../lib/forkinator/scannerPromptLayout';
import {
  markForkinatorAisleSortUsed,
  readForkinatorAisleSortUsed,
  shouldAutoShowForkinatorAisleSortPrompt,
} from '../lib/forkinator/aisleSortPrompt';
import { FORKINATOR_AISLE_SORT_MESSAGE } from '../lib/forkinator/aisleSortPromptCopy';
import {
  markForkinatorExpirationPromptShown,
  shouldAutoShowForkinatorExpirationPrompt,
} from '../lib/forkinator/expirationPrompt';
import { buildForkinatorExpirationPromptMessage } from '../lib/forkinator/expirationPromptCopy';
import { canSyncForkinatorWebCameraScan } from '../lib/forkinator/forkinatorWebCameraScan';
import {
  filterPantryExpiringWithinOneDay,
  isPantryItemExpiringWithinOneDay,
} from '../lib/pantry/expiringWithinOneDay';
import { addDaysToIsoDate, todayIsoDate } from '../lib/pantry/expiry';
import {
  consumeOpenPantryShelfScanRequest,
  requestOpenPantryShelfScan,
} from '../lib/pantry/openShelfScanRequest';
import { photoScanAccessState } from '../lib/plans/photoScanAccess';
import { resolveForkinatorMascotPose } from '../lib/forkinator/forkinatorPose';
import {
  buildRestockReminderMessage,
  isStaplePantryQuantityLow,
  parseStapleIngredientId,
  planStapleRestockLines,
  STAPLE_LOW_STOCK_FRACTION,
  stapleReferenceQuantity,
} from '../lib/forkinator/restockReminders';
import { getStapleById } from '../lib/pantry/stapleCatalog';
import {
  FORKINATOR_FORK_IN_ROAD_HOME_IDLE_MS,
  resetForkInRoadHomeIdleTimer,
  setForkInRoadHomeFocused,
} from '../lib/forkinator/forkInRoadIdle';
import {
  markForkInRoadPromptDismissed,
  shouldAutoShowForkInRoadPrompt,
  FORKINATOR_FORK_IN_ROAD_LAST_SHOWN_DAY_KEY,
  FORKINATOR_FORK_IN_ROAD_COOLDOWN_UNTIL_DAY_KEY,
} from '../lib/forkinator/forkInRoadPrompt';
import {
  pickForkInRoadRecipes,
  scoreForkInRoadKitchenRecipe,
  type ForkInRoadQuizAnswers,
} from '../lib/forkinator/forkInRoadQuiz';
import type { PantryItem, Recipe } from '../types/mealprep';
import type { RecipePantryMatch } from '../lib/recipeMatch';
import {
  layoutThinkingBubble,
  THINKING_BUBBLE_TAIL_HEIGHT,
} from '../lib/forkinator/thinkingBubbleLayout';
import {
  FORKINATOR_TAP_MOVE_THRESHOLD_PX,
  isForkinatorTapRelease,
} from '../lib/forkinator/tapGesture';
import { readJson, removeStorageKey } from '../lib/storage';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');

assert.ok(Math.abs(FORKINATOR_ASPECT_WIDTH_TO_HEIGHT - 44 / 120) < 0.001);
assert.equal(FORKINATOR_WIDTH_PX, 44);
assert.equal(FORKINATOR_HEIGHT_PX, 120);
assert.equal(THINKING_BUBBLE_TAIL_HEIGHT, 28);
assert.equal(FORKINATOR_SCANNER_PROMPT_AUTO_SHOW_DELAY_MS, 2000);
assert.equal(FORKINATOR_GREETING_AUTO_SHOW_DELAY_MS, 2000);
assert.equal(FORKINATOR_GREETING_AUTO_HIDE_MS, 8000);
assert.equal(FORKINATOR_GREETING_SHOWN_STORAGE_KEY, 'mealprep.forkinator.greetingShown');
assert.equal(
  FORKINATOR_GREETING_MESSAGE,
  "Hey there! The name's Forky McForkface. I'm here to help.",
);
assert.equal(FORKINATOR_GREETING_A11Y_LABEL, 'Dismiss greeting');

removeStorageKey(FORKINATOR_GREETING_SHOWN_STORAGE_KEY);
assert.equal(shouldAutoShowForkinatorGreeting(false), true);
const firstSession = forkinatorPromptSessionPlan(false, true);
assert.equal(firstSession.showGreeting, true);
assert.equal(firstSession.showScanner, false, 'first open: greeting only, no scanner');
markForkinatorGreetingShown();
assert.equal(readForkinatorGreetingShown(), true);
assert.equal(shouldAutoShowForkinatorGreeting(true), false, 'greeting never shows again');
const nextSession = forkinatorPromptSessionPlan(true, true);
assert.equal(nextSession.showGreeting, false);
assert.equal(nextSession.showScanner, true, 'scanner eligible on a later session');

const tapNone = {
  greetingPromptVisible: false,
  expirationPromptVisible: false,
  restockPromptVisible: false,
  forkInRoadPromptVisible: false,
  aisleSortPromptVisible: false,
  scannerPromptVisible: false,
};

assert.equal(
  resolveForkinatorMascotTapAction({
    ...tapNone,
    greetingPromptVisible: true,
  }),
  'dismissGreetingPrompt',
);
assert.equal(
  resolveForkinatorMascotTapAction({
    ...tapNone,
    expirationPromptVisible: true,
  }),
  'dismissExpirationPrompt',
);
assert.equal(
  resolveForkinatorMascotTapAction({
    ...tapNone,
    restockPromptVisible: true,
  }),
  'dismissRestockPrompt',
);
assert.equal(
  resolveForkinatorMascotTapAction({
    ...tapNone,
    forkInRoadPromptVisible: true,
  }),
  'dismissForkInRoadPrompt',
);
assert.equal(
  resolveForkinatorMascotTapAction({
    ...tapNone,
    aisleSortPromptVisible: true,
  }),
  'dismissAisleSortPrompt',
);
assert.equal(
  resolveForkinatorMascotTapAction({
    ...tapNone,
    scannerPromptVisible: true,
  }),
  'dismissScannerPrompt',
);
assert.equal(resolveForkinatorMascotTapAction(tapNone), 'toggleThinkingBubble');

const poseBase = {
  thinkingVisible: false,
  expirationPromptVisible: false,
  restockPromptVisible: false,
  forkInRoadPromptVisible: false,
  aisleSortPromptVisible: false,
  scannerPromptVisible: false,
  greetingPromptVisible: false,
};

assert.equal(
  resolveForkinatorMascotPose({
    ...poseBase,
    scannerPromptVisible: true,
  }),
  'idea',
);
assert.equal(
  resolveForkinatorMascotPose({
    ...poseBase,
    thinkingVisible: true,
    expirationPromptVisible: true,
    aisleSortPromptVisible: true,
    scannerPromptVisible: true,
  }),
  'thinking',
);
assert.equal(
  resolveForkinatorMascotPose({
    ...poseBase,
    forkInRoadPromptVisible: true,
  }),
  'thinking',
);
assert.equal(
  resolveForkinatorMascotPose({
    ...poseBase,
    expirationPromptVisible: true,
  }),
  'sad',
);
assert.equal(
  resolveForkinatorMascotPose({
    ...poseBase,
    restockPromptVisible: true,
  }),
  'idea',
);
assert.equal(
  resolveForkinatorMascotPose({
    ...poseBase,
    aisleSortPromptVisible: true,
  }),
  'idea',
);
assert.equal(
  resolveForkinatorMascotPose({
    ...poseBase,
    greetingPromptVisible: true,
  }),
  'full',
);
assert.equal(resolveForkinatorMascotPose(poseBase), 'full');
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

const promptAtDefault390 = layoutScannerPrompt({
  mascotX: default390.x,
  mascotY: default390.y,
  mascotWidth: FORKINATOR_WIDTH_PX,
  mascotHeight: FORKINATOR_HEIGHT_PX,
  screenWidth: 390,
  screenHeight: 844,
  insetTop: 47,
  insetRight: 0,
  insetBottom: 34,
  insetLeft: 0,
});
assert.equal(promptAtDefault390.placement, 'above', 'prompt should sit above mascot at default 390');
assert.ok(promptAtDefault390.left >= bounds390.insetLeft);
assert.ok(promptAtDefault390.left + promptAtDefault390.width <= 390);

const promptAtDefault320 = layoutScannerPrompt({
  mascotX: default320.x,
  mascotY: default320.y,
  mascotWidth: FORKINATOR_WIDTH_PX,
  mascotHeight: FORKINATOR_HEIGHT_PX,
  screenWidth: 320,
  screenHeight: 568,
  insetTop: 44,
  insetRight: 0,
  insetBottom: 28,
  insetLeft: 0,
});
assert.equal(promptAtDefault320.placement, 'above', 'prompt should sit above mascot at default 320');
assert.ok(promptAtDefault320.left >= bounds320.insetLeft);
assert.ok(promptAtDefault320.left + promptAtDefault320.width <= 320);
assert.ok(scannerPromptBodySize(320).bodyWidth <= 320 - 16);
const greetingBody320 = scannerPromptBodySize(320, FORKINATOR_GREETING_MESSAGE);
assert.ok(greetingBody320.bodyWidth <= 320 - 16);
assert.ok(greetingBody320.bodyHeight <= 96, 'longer name should wrap in thought bubble on narrow phones');
const scannerBody320 = scannerPromptBodySize(320, FORKINATOR_SCANNER_NUDGE_MESSAGE, true);
assert.ok(scannerBody320.bodyWidth <= 320 - 16);
assert.ok(scannerBody320.bodyHeight <= 120, 'scanner prompt with camera button fits narrow phones');

requestOpenPantryShelfScan('camera');
assert.equal(consumeOpenPantryShelfScanRequest(), 'camera');
assert.equal(consumeOpenPantryShelfScanRequest(), null);
requestOpenPantryShelfScan('menu');
assert.equal(consumeOpenPantryShelfScanRequest(), 'menu');
const today = todayIsoDate();
const tomorrow = addDaysToIsoDate(today, 1);
const dayAfter = addDaysToIsoDate(today, 2);
const yesterday = addDaysToIsoDate(today, -1);
assert.equal(isPantryItemExpiringWithinOneDay({ expiresOn: today }), true);
assert.equal(isPantryItemExpiringWithinOneDay({ expiresOn: tomorrow }), true);
assert.equal(isPantryItemExpiringWithinOneDay({ expiresOn: dayAfter }), false);
assert.equal(isPantryItemExpiringWithinOneDay({ expiresOn: yesterday }), false);
const expiringSample = filterPantryExpiringWithinOneDay([
  {
    id: 'a',
    name: 'Spinach',
    expiresOn: today,
    quantity: 1,
    unit: 'bag',
    category: 'produce',
    location: 'fridge',
    photoUri: null,
  },
  {
    id: 'b',
    name: 'Rice',
    expiresOn: dayAfter,
    quantity: 1,
    unit: 'cup',
    category: 'dry_goods',
    location: 'pantry',
    photoUri: null,
  },
] as import('../types/mealprep').PantryItem[]);
assert.equal(expiringSample.length, 1);
assert.match(buildForkinatorExpirationPromptMessage(expiringSample), /Spinach/);
assert.equal(
  shouldAutoShowForkinatorAisleSortPrompt({
    openGroceryItemCount: 5,
    showMealGrouping: true,
    combineByAisle: false,
    aisleSortUsed: false,
  }),
  true,
);
assert.equal(
  shouldAutoShowForkinatorAisleSortPrompt({
    openGroceryItemCount: 4,
    showMealGrouping: true,
    combineByAisle: false,
    aisleSortUsed: false,
  }),
  false,
);
markForkinatorAisleSortUsed();
assert.equal(readForkinatorAisleSortUsed(), true);
const expirationPlan = shouldAutoShowForkinatorExpirationPrompt([
  {
    id: 'spinach-1',
    name: 'Spinach',
    expiresOn: today,
    quantity: 1,
    unit: 'bag',
    category: 'produce',
    location: 'fridge',
    photoUri: null,
  },
] as import('../types/mealprep').PantryItem[]);
assert.equal(expirationPlan.show, true);
markForkinatorExpirationPromptShown(['spinach-1']);
assert.equal(shouldAutoShowForkinatorExpirationPrompt(expirationPlan.items).show, false);
assert.equal(
  canSyncForkinatorWebCameraScan({
    demoMode: false,
    authReady: true,
    hasSession: true,
    plan: 'paid',
    role: 'member',
    profileReady: true,
  }),
  photoScanAccessState({
    demoMode: false,
    authReady: true,
    hasSession: true,
    plan: 'paid',
    role: 'member',
    profileReady: true,
  }) === 'allowed',
);
assert.equal(
  canSyncForkinatorWebCameraScan({
    demoMode: false,
    authReady: false,
    hasSession: false,
    plan: 'paid',
    role: 'member',
    profileReady: true,
  }),
  false,
);

const clamped = clampForkinatorPosition({ x: -50, y: 9999 }, bounds390);
assert.equal(clamped.x, bounds390.insetLeft);
assert.equal(clamped.y, bounds390.height - bounds390.insetBottom - bounds390.mascotHeight);

assert.equal(FORKINATOR_POSITION_STORAGE_KEY, 'mealprep.forkinator.position');
assert.equal(FORKINATOR_HAS_SCANNED_STORAGE_KEY, 'mealprep.forkinator.hasScanned');
assert.equal(FORKINATOR_ACCESSIBILITY_LABEL, 'Forky McForkface');
assert.equal(FORKINATOR_ACCESSIBILITY_HINT, 'Tap to show thinking bubble');

writeForkinatorHasScanned(false);
assert.equal(readForkinatorHasScanned(), false);
markForkinatorPantryScanCompleted();
assert.equal(readForkinatorHasScanned(), true);
assert.equal(readJson(FORKINATOR_HAS_SCANNED_STORAGE_KEY, false), true);
writeForkinatorHasScanned(false);

assert.equal(
  FORKINATOR_SCANNER_NUDGE_LAST_SHOWN_STORAGE_KEY,
  'mealprep.forkinator.scannerNudgeLastShownAt',
);
assert.equal(FORKINATOR_SCANNER_NUDGE_COOLDOWN_MS, 3 * 24 * 60 * 60 * 1000);

const now = Date.UTC(2026, 9, 7, 12, 0, 0);
removeStorageKey(FORKINATOR_SCANNER_NUDGE_LAST_SHOWN_STORAGE_KEY);
assert.equal(shouldAutoShowForkinatorScannerPrompt(false, now), true);
writeForkinatorScannerNudgeLastShownAt(now - 24 * 60 * 60 * 1000);
assert.equal(shouldAutoShowForkinatorScannerPrompt(false, now), false);
writeForkinatorScannerNudgeLastShownAt(now - FORKINATOR_SCANNER_NUDGE_COOLDOWN_MS);
assert.equal(shouldAutoShowForkinatorScannerPrompt(false, now), true);
assert.equal(shouldAutoShowForkinatorScannerPrompt(true, now, null), false);


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

const overlaysSource = fs.readFileSync(path.join(mobileRoot, 'components/AppOverlays.tsx'), 'utf8');
assert.match(overlaysSource, /ForkinatorOverlay/, 'Forkinator should mount from AppOverlays');
assert.match(overlaysSource, /pointerEvents="box-none"/, 'overlay root should not steal touches');

const forkinatorDir = path.join(mobileRoot, 'components/forkinator');
const overlaySource = fs.readFileSync(path.join(forkinatorDir, 'ForkinatorOverlay.tsx'), 'utf8');
assert.match(overlaySource, /forkinatorPose/, 'overlay should resolve mascot pose');
assert.match(overlaySource, /resolveForkinatorMascotPose/, 'overlay should map prompt state to pose');
assert.match(overlaySource, /FORKINATOR_MASCOT_POSE_SOURCES/, 'all pose assets required up front');
assert.match(overlaySource, /readForkinatorPosition/, 'overlay should restore saved position');
assert.match(overlaySource, /writeForkinatorPosition/, 'overlay should persist position on release');
assert.match(overlaySource, /pointerEvents="box-none"/, 'Forkinator overlay wrapper passes touches through');
assert.match(overlaySource, /accessibilityRole="button"/);
assert.match(overlaySource, /accessibilityHint=\{FORKINATOR_ACCESSIBILITY_HINT\}/);
assert.match(overlaySource, /forkinatorDragSurfaceWebStyle/, 'web drag surface should disable browser gestures');
assert.match(overlaySource, /draggable: false/, 'mascot image should not be natively draggable on web');
assert.match(overlaySource, /onPointerDown/, 'web should use pointer events for drag');
assert.match(overlaySource, /FORKINATOR_HIT_WIDTH_PX/, 'touch target should use reduced hit area');
assert.match(overlaySource, /onKeyDown/, 'web keyboard should activate mascot');
assert.match(overlaySource, /handleMascotActivate/, 'keyboard and tap share mascot activation');
assert.match(overlaySource, /resolveForkinatorMascotTapAction/, 'prompt visible dismisses without thinking bubble');
assert.match(overlaySource, /ForkinatorScannerPrompt/, 'greeting and scanner prompts share one component');
assert.match(overlaySource, /FORKINATOR_GREETING_MESSAGE/, 'greeting uses thought-style prompt');
assert.match(overlaySource, /FORKINATOR_GREETING_AUTO_HIDE_MS/, 'greeting auto-hides');
assert.match(overlaySource, /const mascotReady = position !== null && width > 0 && height > 0/);
assert.match(overlaySource, /autoShowPromptTimerRef/, 'auto-show timer stored in ref');
assert.match(
  overlaySource,
  /autoShowScheduledRef\.current = true[\s\S]*?\}, \[mascotReady, pantry\]\)/,
  'auto-show effect must not depend on position',
);
assert.doesNotMatch(
  overlaySource,
  /autoShowScheduledRef\.current = true[\s\S]{0,1200}\[height, position, width\]/,
);
assert.match(overlaySource, /blockScannerThisSessionRef/, 'scanner waits until after greeting session');
assert.match(overlaySource, /greetingPromptVisible/, 'only one prompt visible at a time');
assert.match(overlaySource, /FORKINATOR_SCANNER_PROMPT_AUTO_SHOW_DELAY_MS/, 'prompt auto-shows after delay');
assert.match(overlaySource, /layoutScannerPrompt/, 'prompt follows mascot position');
assert.match(overlaySource, /tabIndex: 0/, 'web mascot should be focusable');
assert.match(overlaySource, /isForkinatorTapRelease/, 'tap should use movement threshold helper');
assert.match(overlaySource, /setThinkingVisible/, 'tap should toggle thinking bubble when prompt hidden');
assert.ok(!overlaySource.includes('Animated'), 'mascot overlay should stay unanimated');

const bubbleSource = fs.readFileSync(
  path.join(forkinatorDir, 'ForkinatorThinkingBubble.tsx'),
  'utf8',
);
assert.match(bubbleSource, /Animated/, 'thinking bubble may animate');
assert.match(bubbleSource, /pointerEvents="none"/, 'bubble should pass touches through');
assert.match(bubbleSource, /ThinkingDots/, 'thinking bubble shows pulsing dots only');
assert.match(bubbleSource, /reduceMotion/, 'bubble should respect reduce motion');
assert.match(bubbleSource, /USE_NATIVE_DRIVER/, 'bubble should gate native driver on web');
assert.ok(
  !bubbleSource.includes('FORKINATOR_SCANNER_NUDGE_MESSAGE'),
  'thinking bubble must not include scanner message text',
);
assert.ok(!bubbleSource.includes('tip'), 'bubble should not include tip copy');

const promptSource = fs.readFileSync(path.join(forkinatorDir, 'ForkinatorScannerPrompt.tsx'), 'utf8');
assert.match(promptSource, /message/);
assert.match(promptSource, /accessibilityLabel/);
assert.equal(
  FORKINATOR_SCANNER_NUDGE_MESSAGE,
  "Let's see what you're working with. Scan your fridge and I'll find dinner.",
);
assert.match(promptSource, /USE_NATIVE_DRIVER/, 'scanner prompt should gate native driver on web');
assert.match(promptSource, /accessibilityRole="button"/);
assert.match(promptSource, /TailCircles/, 'prompt should use thought-cloud tail circles');
assert.ok(!promptSource.includes('SpeechPointer'), 'prompt should not use speech triangle pointer');
assert.match(promptSource, /actionButton/, 'thought prompt supports action pill button');
assert.match(promptSource, /actionButton\.label/, 'prompt pill uses action button label');
assert.match(promptSource, /actionButton\.accessibilityLabel/, 'prompt pill uses action button a11y');

const appContextSource = fs.readFileSync(path.join(mobileRoot, 'context/AppContext.tsx'), 'utf8');
assert.match(appContextSource, /markForkinatorPantryScanCompleted/, 'scan review save should set hasScanned');
assert.match(appContextSource, /emitForkinatorRestockAfterCook/, 'cook flow should queue restock check');

const grocerySource = fs.readFileSync(path.join(mobileRoot, 'app/(tabs)/grocery.tsx'), 'utf8');
const pantrySource = fs.readFileSync(path.join(mobileRoot, 'app/(tabs)/pantry.tsx'), 'utf8');
assert.match(pantrySource, /consumeOpenPantryShelfScanRequest/, 'pantry should honor Forkinator scan requests');
assert.match(pantrySource, /autoOpenScanMode/, 'pantry should auto-open scan menu or camera');
const scanButtonsWeb = fs.readFileSync(
  path.join(mobileRoot, 'components/PantryStorageScanButtons.web.tsx'),
  'utf8',
);
assert.ok(
  !/autoOpenScanMode === 'camera'/.test(scanButtonsWeb),
  'web should not open camera from post-navigation effect',
);
assert.match(scanButtonsWeb, /setSourceMenuOpen\(true\)/, 'web auto-open shows source menu only');
assert.match(overlaySource, /pickWebImageFile/, 'web scan now opens camera picker in tap handler');
assert.match(overlaySource, /openPantryWithWebShelfScanFile/, 'web hands picked file to pantry');
assert.match(overlaySource, /canSyncForkinatorWebCameraScan/, 'web falls back when gate not sync-ready');
assert.match(pantrySource, /consumePantryWebShelfScanFile/, 'pantry consumes web shelf scan handoff');
assert.match(overlaySource, /openPantryCameraScanFromForkinator/, 'scanner prompt camera button opens camera mode');
assert.match(overlaySource, /includeCameraButton: true/, 'scanner prompt layout reserves button space');
assert.match(overlaySource, /FORKINATOR_AISLE_SORT_MESSAGE/);
assert.match(overlaySource, /buildForkinatorExpirationPromptMessage/);
assert.match(overlaySource, /forkinator-sad\.png/);
assert.match(overlaySource, /sessionAutoPromptShownRef/);
assert.match(overlaySource, /restockPromptVisible/);
assert.match(overlaySource, /forkInRoadPromptVisible/);
assert.match(overlaySource, /emitForkinatorRestockAfterCook|subscribeForkinatorRestockAfterCook/);
assert.match(grocerySource, /markForkinatorAisleSortUsed/);
assert.match(pantrySource, /consumePantryExpiringHighlightRequest/);
assert.equal(FORKINATOR_AISLE_SORT_MESSAGE.includes('aisle'), true);

const homeSource = fs.readFileSync(path.join(mobileRoot, 'app/(tabs)/index.tsx'), 'utf8');
assert.match(homeSource, /useForkInRoadHomeIdle/);
assert.match(homeSource, /resetForkInRoadHomeIdleTimer/);

assert.equal(STAPLE_LOW_STOCK_FRACTION, 0.25);
assert.deepEqual(parseStapleIngredientId('staple-milk'), { stapleId: 'milk' });
assert.deepEqual(parseStapleIngredientId('staple-eggs-12'), { stapleId: 'eggs', varietyId: '12' });
const milkStaple = getStapleById('milk');
assert.ok(milkStaple);
const milkRef = stapleReferenceQuantity(milkStaple!);
assert.equal(isStaplePantryQuantityLow(milkStaple!, 0, 'gal'), true);
assert.equal(isStaplePantryQuantityLow(milkStaple!, milkRef * STAPLE_LOW_STOCK_FRACTION, 'gal'), true);
assert.equal(isStaplePantryQuantityLow(milkStaple!, milkRef * 0.5, 'gal'), false);

const lowPantry: PantryItem[] = [
  {
    id: 'p1',
    ingredientId: 'staple-milk',
    name: 'Milk',
    category: 'dairy',
    quantity: 0.1,
    unit: 'gal',
    location: 'fridge',
    photoUri: null,
    expiresOn: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'p2',
    ingredientId: 'staple-eggs',
    name: 'Eggs',
    category: 'dairy',
    quantity: 2,
    unit: 'each',
    location: 'fridge',
    photoUri: null,
    expiresOn: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];
const restockPlan = planStapleRestockLines(lowPantry, []);
assert.equal(restockPlan.length, 2);
assert.equal(
  buildRestockReminderMessage(['milk', 'eggs']),
  "You're running low on milk and eggs, so I added them to your grocery list.",
);
assert.equal(
  buildRestockReminderMessage(['milk', 'eggs', 'butter']),
  "You're running low on milk, eggs, and 1 more, so I added them to your grocery list.",
);
const deduped = planStapleRestockLines(lowPantry, [
  {
    id: 'g1',
    ingredientId: 'manual-milk',
    name: 'Milk',
    category: 'dairy',
    quantity: 1,
    unit: 'gal',
    checked: false,
    sourceRecipeIds: [],
    origin: 'manual',
    plannedMealLinks: [],
  },
]);
assert.equal(deduped.length, 1);
assert.equal(deduped[0]?.stapleId, 'eggs');

assert.equal(FORKINATOR_FORK_IN_ROAD_HOME_IDLE_MS, 10_000);
setForkInRoadHomeFocused(false);
resetForkInRoadHomeIdleTimer();
setForkInRoadHomeFocused(true);

removeStorageKey(FORKINATOR_FORK_IN_ROAD_LAST_SHOWN_DAY_KEY);
removeStorageKey(FORKINATOR_FORK_IN_ROAD_COOLDOWN_UNTIL_DAY_KEY);
const forkDay = new Date(Date.UTC(2026, 9, 7, 12, 0, 0));
assert.equal(shouldAutoShowForkInRoadPrompt(forkDay), true);
markForkInRoadPromptDismissed(forkDay);
markForkInRoadPromptDismissed(forkDay);
assert.equal(shouldAutoShowForkInRoadPrompt(forkDay), false);
assert.equal(
  readJson<string | null>(FORKINATOR_FORK_IN_ROAD_COOLDOWN_UNTIL_DAY_KEY, null),
  '2026-10-10',
);

const fastRecipe: Recipe = {
  id: 'r-fast',
  name: 'Quick chicken stir-fry',
  tag: 'dinner',
  description: 'Fast weeknight chicken',
  servings: 4,
  minutes: 20,
  calories: 400,
  protein: 30,
  carbs: 20,
  fat: 10,
  ingredients: [{ ingredientId: 'i1', name: 'chicken breast', quantity: 1, unit: 'lb' }],
  steps: ['Cook'],
  isMaster: false,
  createdAt: '',
};
const fancyRecipe: Recipe = {
  ...fastRecipe,
  id: 'r-fancy',
  name: 'Beef wellington',
  description: 'Fancy beef dinner',
  minutes: 90,
  ingredients: Array.from({ length: 12 }, (_, index) => ({
    ingredientId: `i${index}`,
    name: `ingredient ${index}`,
    quantity: 1,
    unit: 'cup',
  })),
  steps: Array.from({ length: 10 }, () => 'Step'),
};
const zeroMatch = (recipe: Recipe): RecipePantryMatch => ({
  recipeId: recipe.id,
  recipeName: recipe.name,
  totalIngredients: recipe.ingredients.length,
  matchedCount: 0,
  missingCount: recipe.ingredients.length,
  percentMatch: 0,
  matched: [],
  missing: recipe.ingredients,
});
const fullMatch: RecipePantryMatch = {
  ...zeroMatch(fastRecipe),
  matchedCount: 1,
  missingCount: 0,
  percentMatch: 100,
  matched: [],
  missing: [],
};
const quizAnswers: ForkInRoadQuizAnswers = {
  mood: 'fast',
  pantry: 'use_pantry',
  protein: 'chicken',
};
assert.ok(
  scoreForkInRoadKitchenRecipe(fastRecipe, fullMatch, quizAnswers) >
    scoreForkInRoadKitchenRecipe(fancyRecipe, zeroMatch(fancyRecipe), quizAnswers),
);
const picks = pickForkInRoadRecipes(
  [
    { kind: 'kitchen', recipe: fancyRecipe, match: zeroMatch(fancyRecipe) },
    { kind: 'kitchen', recipe: fastRecipe, match: fullMatch },
  ],
  quizAnswers,
  2,
);
assert.equal(picks[0]?.recipe.id, 'r-fast');

const accountSource = fs.readFileSync(path.join(mobileRoot, 'components/account/AccountSheet.tsx'), 'utf8');
assert.ok(!/Forkinator/i.test(accountSource), 'Account settings should not include Forkinator toggle');

const libForkinatorDir = path.join(mobileRoot, 'lib/forkinator');
assert.ok(fs.existsSync(path.join(libForkinatorDir, 'position.ts')), 'position helpers should exist');
assert.ok(fs.existsSync(path.join(libForkinatorDir, 'hitArea.ts')), 'hit area helpers should exist');
assert.ok(fs.existsSync(path.join(libForkinatorDir, 'hasScanned.ts')), 'hasScanned helpers should exist');
assert.ok(fs.existsSync(path.join(libForkinatorDir, 'scannerNudgeCooldown.ts')));
assert.ok(fs.existsSync(path.join(libForkinatorDir, 'scannerPromptLayout.ts')));
assert.ok(fs.existsSync(path.join(libForkinatorDir, 'greetingShown.ts')));
assert.ok(!fs.existsSync(path.join(libForkinatorDir, 'engine.ts')), 'tip engine should not exist');

const assetsDir = path.join(mobileRoot, 'assets/forkinator');
assert.ok(fs.existsSync(path.join(assetsDir, 'forkinator-full.png')), 'full-body asset should exist');
for (const poseFile of ['forkinator-idea.png', 'forkinator-thinking.png', 'forkinator-sad.png']) {
  const posePath = path.join(assetsDir, poseFile);
  assert.ok(fs.existsSync(posePath), `${poseFile} should exist`);
  const stat = fs.statSync(posePath);
  assert.ok(stat.size <= 150_000, `${poseFile} should stay under ~150KB`);
}

console.log('forkinator-check: ok');
