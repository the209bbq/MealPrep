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
  FORKINATOR_HIT_INSET_TOP_PX,
  FORKINATOR_HIT_WIDTH_PX,
} from '../lib/forkinator/hitArea';
import { FORKINATOR_TAB_BAR_HEIGHT_PX } from '../lib/forkinator/forkinatorTabBar';
import {
  clampForkinatorPosition,
  defaultForkinatorPosition,
  defaultForkinatorPositionForTab,
  FORKINATOR_ASPECT_WIDTH_TO_HEIGHT,
  FORKINATOR_DEFAULT_BOTTOM_MARGIN_PX,
  FORKINATOR_DEFAULT_LEFT_INSET_PX,
  FORKINATOR_HEIGHT_PX,
  FORKINATOR_LEGACY_DOCK_ZONE_TOLERANCE_X_PX,
  FORKINATOR_POSITION_EPOCH,
  FORKINATOR_POSITION_EPOCH_KEY,
  FORKINATOR_POSITION_STORAGE_KEY,
  FORKINATOR_WIDTH_PX,
  isStoredPositionInLegacyDockZone,
  legacyDefaultForkinatorPosition,
  readForkinatorPosition,
  resolveForkinatorPosition,
  writeForkinatorPosition,
} from '../lib/forkinator/position';
import { forkInRoadPillBoundsAtDefaultDock } from '../lib/forkinator/defaultDockCloudLayout';
import { FORKINATOR_FORK_IN_ROAD_PILL_LABEL } from '../lib/forkinator/forkInRoadPromptCopy';
import {
  FORKINATOR_TIPS_PRESERVED_STORAGE_KEYS,
  FORKINATOR_TIPS_RESET_STORAGE_KEYS,
  resetForkinatorTipsStorage,
} from '../lib/forkinator/resetForkinatorTips';
import { writeJson } from '../lib/storage';
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
  PROMPT_BUBBLE_TAIL_HEIGHT,
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
  FORKINATOR_TAP_MOVE_THRESHOLD_PX,
  isForkinatorTapRelease,
} from '../lib/forkinator/tapGesture';
import { readJson, removeStorageKey } from '../lib/storage';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');

assert.ok(Math.abs(FORKINATOR_ASPECT_WIDTH_TO_HEIGHT - 44 / 120) < 0.001);
assert.equal(FORKINATOR_WIDTH_PX, 44);
assert.equal(FORKINATOR_HEIGHT_PX, 120);
assert.equal(PROMPT_BUBBLE_TAIL_HEIGHT, 28);
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
  forkInRoadExpanded: false,
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
    forkInRoadExpanded: false,
  }),
  'none',
  'collapsed pill: tapping Forky does nothing',
);
assert.equal(
  resolveForkinatorMascotTapAction({
    ...tapNone,
    forkInRoadPromptVisible: true,
    forkInRoadExpanded: true,
  }),
  'collapseForkInRoadPrompt',
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
assert.equal(resolveForkinatorMascotTapAction(tapNone), 'none', 'tap with no prompt does nothing (bubble removed)');

const poseBase = {
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
    expirationPromptVisible: true,
    aisleSortPromptVisible: true,
    scannerPromptVisible: true,
  }),
  'sad',
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
const legacy390 = legacyDefaultForkinatorPosition(bounds390);
assert.ok(
  default390.x <= bounds390.insetLeft + FORKINATOR_DEFAULT_LEFT_INSET_PX + 2,
  'default should dock on the left',
);
assert.ok(
  legacy390.x >= bounds390.width - bounds390.insetRight - bounds390.mascotWidth - 12,
  'legacy default x should be near the right edge',
);
const maxDefaultY390 =
  bounds390.height -
  bounds390.insetBottom -
  FORKINATOR_TAB_BAR_HEIGHT_PX -
  FORKINATOR_HIT_INSET_TOP_PX -
  FORKINATOR_HIT_HEIGHT_PX -
  FORKINATOR_DEFAULT_BOTTOM_MARGIN_PX;
assert.equal(default390.y, maxDefaultY390, 'Home default should use the lowest left dock');
const groceryDefault390 = defaultForkinatorPositionForTab(bounds390, false);
assert.ok(
  groceryDefault390.x >= bounds390.width - bounds390.mascotWidth - 12,
  'non-Home default should dock on the right',
);
const hitBottom390 =
  default390.y + FORKINATOR_HIT_INSET_TOP_PX + FORKINATOR_HIT_HEIGHT_PX;
assert.ok(
  hitBottom390 <= bounds390.height - bounds390.insetBottom - FORKINATOR_TAB_BAR_HEIGHT_PX,
  'mascot hit area must not overlap tab bar at 390',
);
/** QA FK5-1: collapsed pill must stay off main Home controls (approx bands from R5 harness). */
function rectsOverlap(
  a: { left: number; top: number; width: number; height: number },
  b: { left: number; top: number; width: number; height: number },
): boolean {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

const homeCategoryChipRow390 = { left: 0, top: 500, width: 390, height: 100 };
const forkPill390 = forkInRoadPillBoundsAtDefaultDock(bounds390);
assert.equal(FORKINATOR_FORK_IN_ROAD_PILL_LABEL, "Can't decide?");
for (const band of [
  homeCategoryChipRow390,
  { left: 8, top: 120, width: 304, height: 44, name: 'search 390' },
  { left: 8, top: 280, width: 304, height: 44, name: 'paste 390' },
  { left: 8, top: 360, width: 120, height: 44, name: 'import 390' },
  { left: 8, top: 430, width: 280, height: 36, name: 'see more curated 390' },
]) {
  assert.ok(!rectsOverlap(forkPill390, band), `pill 390 must not overlap ${(band as { name?: string }).name ?? 'chip row'}`);
}

removeStorageKey(FORKINATOR_POSITION_STORAGE_KEY);
removeStorageKey(FORKINATOR_POSITION_EPOCH_KEY);
writeForkinatorPosition(legacy390);
assert.deepEqual(resolveForkinatorPosition(bounds390), default390, 'unmoved legacy default migrates');
assert.equal(readJson(FORKINATOR_POSITION_EPOCH_KEY, null), FORKINATOR_POSITION_EPOCH);
writeForkinatorPosition({
  x: legacy390.x - 3,
  y: legacy390.y - 3,
});
removeStorageKey(FORKINATOR_POSITION_EPOCH_KEY);
assert.deepEqual(
  resolveForkinatorPosition(bounds390),
  default390,
  'legacy default with tap jitter migrates (FK5-4)',
);
const bounds390Short = { ...bounds390, height: 800, insetBottom: 0 };
const legacyAt800 = legacyDefaultForkinatorPosition(bounds390Short);
writeForkinatorPosition({ x: legacyAt800.x, y: legacyAt800.y });
removeStorageKey(FORKINATOR_POSITION_EPOCH_KEY);
assert.deepEqual(
  resolveForkinatorPosition(bounds390),
  default390,
  'legacy default saved at 390×800 migrates when loaded at 390×844',
);
writeForkinatorPosition({ x: 120, y: 200 });
writeJson(FORKINATOR_POSITION_EPOCH_KEY, 1);
assert.deepEqual(resolveForkinatorPosition(bounds390), { x: 120, y: 200 }, 'custom position is kept');
assert.equal(
  isStoredPositionInLegacyDockZone({ x: legacy390.x - 3, y: legacy390.y - 3 }, bounds390),
  true,
);
assert.equal(isStoredPositionInLegacyDockZone({ x: 120, y: 200 }, bounds390), false);
assert.equal(FORKINATOR_LEGACY_DOCK_ZONE_TOLERANCE_X_PX, 12);
removeStorageKey(FORKINATOR_POSITION_STORAGE_KEY);
removeStorageKey(FORKINATOR_POSITION_EPOCH_KEY);

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
const maxDefaultY320 =
  bounds320.height -
  bounds320.insetBottom -
  FORKINATOR_TAB_BAR_HEIGHT_PX -
  FORKINATOR_HIT_INSET_TOP_PX -
  FORKINATOR_HIT_HEIGHT_PX -
  FORKINATOR_DEFAULT_BOTTOM_MARGIN_PX;
assert.equal(default320.y, maxDefaultY320, '320 Home default uses lowest dock');

const bounds320Tall = {
  width: 320,
  height: 640,
  insetTop: 44,
  insetRight: 0,
  insetBottom: 28,
  insetLeft: 0,
  mascotWidth: FORKINATOR_WIDTH_PX,
  mascotHeight: FORKINATOR_HEIGHT_PX,
};
const forkPill320Tall = forkInRoadPillBoundsAtDefaultDock(bounds320Tall);
for (const band of [
  { left: 0, top: 360, width: 320, height: 90, name: 'chip row 320' },
  { left: 8, top: 100, width: 304, height: 44, name: 'search 320' },
  { left: 8, top: 200, width: 304, height: 44, name: 'paste 320' },
  { left: 8, top: 248, width: 120, height: 44, name: 'import 320' },
]) {
  assert.ok(!rectsOverlap(forkPill320Tall, band), `pill 320×640 must not overlap ${band.name}`);
}

const aisleAtRight390 = layoutScannerPrompt({
  mascotX: groceryDefault390.x,
  mascotY: groceryDefault390.y,
  mascotWidth: FORKINATOR_WIDTH_PX,
  mascotHeight: FORKINATOR_HEIGHT_PX,
  screenWidth: 390,
  screenHeight: 844,
  insetTop: 47,
  insetRight: 0,
  insetBottom: 34,
  insetLeft: 0,
  message: FORKINATOR_AISLE_SORT_MESSAGE,
  includeActionButton: true,
  preferSideOverAbove: true,
});
assert.equal(
  aisleAtRight390.placement,
  'left',
  'grocery aisle cloud should sit to the left of right-docked Forky (FK5-3)',
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
assert.equal(clamped.y, maxDefaultY390, 'clamp should respect tab bar and hit area');

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

// Text clouds sit fully above Forky's head or off to the side — never over his body — and stay
// on-screen and clear of the tab bar wherever he is dragged.
const promptMessages: { message: string; includeActionButton: boolean }[] = [
  { message: FORKINATOR_GREETING_MESSAGE, includeActionButton: false },
  { message: FORKINATOR_SCANNER_NUDGE_MESSAGE, includeActionButton: true },
  { message: FORKINATOR_AISLE_SORT_MESSAGE, includeActionButton: true },
  {
    message: "You're running low on milk, eggs, and 1 more, so I added them to your grocery list.",
    includeActionButton: true,
  },
  { message: 'That QA Milk and 1 more item are living on borrowed time!', includeActionButton: true },
];
for (const screen of [
  { width: 390, height: 844, insetTop: 47, insetBottom: 34 },
  { width: 320, height: 568, insetTop: 20, insetBottom: 0 },
]) {
  const maxX = screen.width - FORKINATOR_WIDTH_PX;
  const maxY = screen.height - screen.insetBottom - FORKINATOR_TAB_BAR_HEIGHT_PX - FORKINATOR_HEIGHT_PX;
  for (const fx of [0, 0.25, 0.5, 0.75, 1]) {
    for (const fy of [0, 0.2, 0.5, 0.8, 1]) {
      const mascotX = Math.round(maxX * fx);
      const mascotY = Math.round(screen.insetTop + (maxY - screen.insetTop) * fy);
      for (const variant of promptMessages) {
        const layout = layoutScannerPrompt({
          mascotX,
          mascotY,
          mascotWidth: FORKINATOR_WIDTH_PX,
          mascotHeight: FORKINATOR_HEIGHT_PX,
          screenWidth: screen.width,
          screenHeight: screen.height,
          insetTop: screen.insetTop,
          insetRight: 0,
          insetBottom: screen.insetBottom,
          insetLeft: 0,
          message: variant.message,
          includeActionButton: variant.includeActionButton,
        });
        const where = `${screen.width}x${screen.height} mascot(${mascotX},${mascotY}) ${layout.placement}`;
        const overlaps =
          layout.left < mascotX + FORKINATOR_WIDTH_PX &&
          layout.left + layout.width > mascotX &&
          layout.top < mascotY + FORKINATOR_HEIGHT_PX &&
          layout.top + layout.height > mascotY;
        assert.ok(!overlaps, `cloud must not cover Forky: ${where}`);
        assert.ok(layout.left >= 0 && layout.left + layout.width <= screen.width, `cloud on-screen x: ${where}`);
        assert.ok(layout.top >= screen.insetTop, `cloud below status bar: ${where}`);
        assert.ok(
          layout.top + layout.height <=
            screen.height - screen.insetBottom - FORKINATOR_TAB_BAR_HEIGHT_PX,
          `cloud clears the tab bar: ${where}`,
        );
        if (layout.placement === 'above') {
          assert.ok(layout.top + layout.height <= mascotY, `above cloud ends over his head: ${where}`);
        }
      }
    }
  }
}
const topLeftLayout = layoutScannerPrompt({
  mascotX: 0,
  mascotY: 47,
  mascotWidth: FORKINATOR_WIDTH_PX,
  mascotHeight: FORKINATOR_HEIGHT_PX,
  screenWidth: 390,
  screenHeight: 844,
  insetTop: 47,
  insetRight: 0,
  insetBottom: 34,
  insetLeft: 0,
});
assert.equal(topLeftLayout.placement, 'right', 'no room above at top-left → cloud flips to his right');
const topRightLayout = layoutScannerPrompt({
  mascotX: 390 - FORKINATOR_WIDTH_PX,
  mascotY: 47,
  mascotWidth: FORKINATOR_WIDTH_PX,
  mascotHeight: FORKINATOR_HEIGHT_PX,
  screenWidth: 390,
  screenHeight: 844,
  insetTop: 47,
  insetRight: 0,
  insetBottom: 34,
  insetLeft: 0,
});
assert.equal(topRightLayout.placement, 'left', 'no room above at top-right → cloud flips to his left');
const midLayout = layoutScannerPrompt({
  mascotX: 200,
  mascotY: 400,
  mascotWidth: FORKINATOR_WIDTH_PX,
  mascotHeight: FORKINATOR_HEIGHT_PX,
  screenWidth: 390,
  screenHeight: 844,
  insetTop: 47,
  insetRight: 0,
  insetBottom: 34,
  insetLeft: 0,
});
assert.equal(midLayout.placement, 'above');
assert.equal(midLayout.top, 400 - midLayout.height - 6, 'above cloud keeps the mascot gap');

const overlaysSource = fs.readFileSync(path.join(mobileRoot, 'components/AppOverlays.tsx'), 'utf8');
assert.match(overlaysSource, /ForkinatorOverlay/, 'Forkinator should mount from AppOverlays');
assert.match(overlaysSource, /MealMadeReviewOverlay/);
assert.match(overlaysSource, /pointerEvents="box-none"/, 'overlay root should not steal touches');

const forkinatorDir = path.join(mobileRoot, 'components/forkinator');
const overlaySource = fs.readFileSync(path.join(forkinatorDir, 'ForkinatorOverlay.tsx'), 'utf8');
const forkinatorEarlyReturn =
  'if (!position || width <= 0 || height <= 0) return null;';
const forkinatorEarlyReturnIdx = overlaySource.indexOf(forkinatorEarlyReturn);
assert.ok(forkinatorEarlyReturnIdx >= 0, 'ForkinatorOverlay size guard early return');
const onWebClickIdx = overlaySource.indexOf('const onWebClick = useCallback');
assert.ok(
  onWebClickIdx >= 0 && onWebClickIdx < forkinatorEarlyReturnIdx,
  'onWebClick must be declared before early return (React hooks order)',
);
const afterForkinatorEarlyReturn = overlaySource.slice(
  forkinatorEarlyReturnIdx + forkinatorEarlyReturn.length,
);
assert.doesNotMatch(
  afterForkinatorEarlyReturn,
  /\buse(?:State|Effect|Memo|Callback|Ref|Context|Reducer|LayoutEffect|ImperativeHandle|Id)\s*\(/,
  'no React hooks after ForkinatorOverlay early return null',
);
assert.match(overlaySource, /forkinatorPose/, 'overlay should resolve mascot pose');
assert.match(overlaySource, /resolveForkinatorMascotPose/, 'overlay should map prompt state to pose');
assert.match(overlaySource, /FORKINATOR_MASCOT_POSE_SOURCES/, 'all pose assets required up front');
assert.match(overlaySource, /resolveForkinatorPosition/, 'overlay should restore and migrate saved position');
assert.match(
  overlaySource,
  /opacity: pose === mascotPose \? 1 : 0/,
  'overlay should keep all mascot poses mounted to avoid stale frames',
);
assert.match(
  overlaySource,
  /!isForkinatorTapRelease[\s\S]*writeForkinatorPosition/,
  'overlay should persist position only after a drag, not a tap',
);
assert.match(overlaySource, /defaultForkinatorPositionForTab/, 'per-tab default dock');
assert.match(overlaySource, /forkinatorUiReady/, 'prompts wait for mascot image load');
assert.match(overlaySource, /onLoad=\{handleMascotImageLoad\}/, 'first pose onLoad gates prompts');
assert.match(overlaySource, /ForkInRoadPrompt/, 'fork in the road uses compact pill + expand');
assert.match(overlaySource, /forkInRoadExpanded/, 'fork in the road expand/collapse state');
assert.match(overlaySource, /preferSideOverAbove: true/, 'aisle sort prefers side placement');
assert.match(overlaySource, /pointerEvents="box-none"/, 'Forkinator overlay wrapper passes touches through');
assert.match(overlaySource, /accessibilityRole="button"/);
assert.match(overlaySource, /accessibilityHint=\{FORKINATOR_ACCESSIBILITY_HINT\}/);
assert.match(overlaySource, /forkinatorDragSurfaceWebStyle/, 'web drag surface should disable browser gestures');
assert.match(overlaySource, /draggable: false/, 'mascot image should not be natively draggable on web');
assert.match(overlaySource, /onPointerDown/, 'web should use pointer events for drag');
assert.match(overlaySource, /onClick/, 'web should activate mascot on plain click for a11y');
assert.match(overlaySource, /subscribeForkinatorTipsReset/);
assert.match(overlaySource, /tipsAutoShowEpoch/);
assert.match(overlaySource, /lastPointerActivateAtRef/, 'web pointer tap records activation time');
assert.match(
  overlaySource,
  /sincePointerActivate < FORKINATOR_WEB_POINTER_ACTIVATE_DEDUPE_MS/,
  'web click must ignore duplicate activation after pointer-up tap',
);
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
  /kitchenPantryReady[\s\S]*?\}, \[kitchenPantryReady, mascotReady, pantryForForkinator, showAutoPrompt, tipsAutoShowEpoch\]\)/,
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
assert.ok(!overlaySource.includes('setThinkingVisible'), 'tap-toggled thinking bubble was removed');
assert.ok(!overlaySource.includes('ForkinatorThinkingBubble'), 'thinking bubble component is gone');
assert.ok(!overlaySource.includes('Animated'), 'mascot overlay should stay unanimated');

assert.ok(
  !fs.existsSync(path.join(forkinatorDir, 'ForkinatorThinkingBubble.tsx')),
  'thinking bubble component deleted',
);

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
assert.match(
  appContextSource,
  /scoreRecipeForPantryDeduction/,
  'meal made should score staples for pantry deduction',
);
assert.match(appContextSource, /kitchenPantryReady/);
assert.match(
  appContextSource,
  /kitchenPantryReady[\s\S]*hydrated[\s\S]*authReady/,
  'kitchenPantryReady should wait for hydration and auth',
);
assert.match(appContextSource, /startMealMadeReview/);

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
assert.match(overlaySource, /\/\(tabs\)\/grocery/, 'grocery tab pathname must trigger aisle prompt');
assert.match(overlaySource, /greetingAutoShowStartedRef/, 'greeting auto-show uses its own latch');
assert.doesNotMatch(overlaySource, /autoShowScheduledRef/, 'global auto-show latch removed');
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
assert.match(accountSource, /resetForkinatorTips/);
assert.match(accountSource, /resetForkyTipsLabel/);
assert.match(accountSource, /confirmResetForkyTips/);

markForkinatorGreetingShown();
markForkinatorPantryScanCompleted();
writeForkinatorPosition({ x: 12, y: 34 });
for (const key of FORKINATOR_TIPS_RESET_STORAGE_KEYS) {
  if (key.endsWith('Day') || key.includes('Fingerprint') || key.includes('CooldownUntil')) {
    writeJson(key, '2026-01-01');
  } else if (key.includes('LastShownAt') || key.includes('Dismissals')) {
    writeJson(key, 1);
  } else {
    writeJson(key, true);
  }
}
resetForkinatorTipsStorage();
assert.equal(readForkinatorGreetingShown(), false);
assert.equal(readForkinatorHasScanned(), true);
assert.deepEqual(readForkinatorPosition(), { x: 12, y: 34 });
for (const key of FORKINATOR_TIPS_RESET_STORAGE_KEYS) {
  assert.ok(!FORKINATOR_TIPS_PRESERVED_STORAGE_KEYS.includes(key));
}
assert.ok(FORKINATOR_TIPS_PRESERVED_STORAGE_KEYS.includes(FORKINATOR_POSITION_STORAGE_KEY));
assert.ok(FORKINATOR_TIPS_PRESERVED_STORAGE_KEYS.includes(FORKINATOR_HAS_SCANNED_STORAGE_KEY));

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
