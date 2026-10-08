import { readJson, writeJson } from '../storage';
import {
  FORKINATOR_HIT_HEIGHT_PX,
  FORKINATOR_HIT_INSET_TOP_PX,
} from './hitArea';
import { FORKINATOR_TAB_BAR_HEIGHT_PX } from './forkinatorTabBar';
export const FORKINATOR_POSITION_STORAGE_KEY = 'mealprep.forkinator.position';
export const FORKINATOR_POSITION_EPOCH_KEY = 'mealprep.forkinator.positionEpoch';
/** Bump when the default dock changes so unmoved mascots can migrate. */
export const FORKINATOR_POSITION_EPOCH = 3;

/** Full-body mascot display size (matches asset aspect ratio ~0.365 width:height). */
export const FORKINATOR_WIDTH_PX = 44;
export const FORKINATOR_HEIGHT_PX = 120;
export const FORKINATOR_ASPECT_WIDTH_TO_HEIGHT = FORKINATOR_WIDTH_PX / FORKINATOR_HEIGHT_PX;

/** Default dock on Home: above the tab bar, hugging the left edge. */
export const FORKINATOR_DEFAULT_LEFT_INSET_PX = 8;
/** Default dock on other tabs: hugging the right edge. */
export const FORKINATOR_DEFAULT_RIGHT_INSET_PX = 8;
export const FORKINATOR_DEFAULT_BOTTOM_MARGIN_PX = 16;
/** Fraction of inner height below the safe-area top for the Home left dock (Playwright 0% overlap). */
export const FORKINATOR_HOME_DOCK_TOP_OFFSET_FRACTION_TALL = 0.221;
export const FORKINATOR_HOME_DOCK_TOP_OFFSET_FRACTION_SHORT = 0.338;
/** Lift right-docked Forky so list row actions stay tappable (Grocery/Pantry). */
export const FORKINATOR_NON_HOME_DOCK_RAISE_PX = 310;

/** Legacy bottom-right dock zone tolerance for epoch migration (FK5-4). */
export const FORKINATOR_LEGACY_DOCK_ZONE_TOLERANCE_X_PX = 12;
export const FORKINATOR_LEGACY_DOCK_ZONE_TOLERANCE_Y_PX = 40;

export type ForkinatorPosition = {
  x: number;
  y: number;
};

export type ForkinatorBounds = {
  width: number;
  height: number;
  insetTop: number;
  insetRight: number;
  insetBottom: number;
  insetLeft: number;
  mascotWidth: number;
  mascotHeight: number;
};

function maxForkinatorPositionY(bounds: ForkinatorBounds): number {
  return (
    bounds.height -
    bounds.insetBottom -
    FORKINATOR_TAB_BAR_HEIGHT_PX -
    FORKINATOR_HIT_INSET_TOP_PX -
    FORKINATOR_HIT_HEIGHT_PX -
    FORKINATOR_DEFAULT_BOTTOM_MARGIN_PX
  );
}

function maxForkinatorPositionX(bounds: ForkinatorBounds): number {
  return Math.max(
    bounds.insetLeft,
    bounds.width - bounds.insetRight - bounds.mascotWidth,
  );
}

/** Pre–FK4-1 default: bottom-right dock (epoch 1). */
export function legacyDefaultForkinatorPosition(bounds: ForkinatorBounds): ForkinatorPosition {
  const x =
    bounds.width -
    bounds.insetRight -
    bounds.mascotWidth -
    FORKINATOR_DEFAULT_RIGHT_INSET_PX;
  const maxY = maxForkinatorPositionY(bounds);
  const y = Math.max(
    bounds.insetTop,
    maxY - FORKINATOR_NON_HOME_DOCK_RAISE_PX,
  );
  return clampForkinatorPosition({ x, y }, bounds);
}

/** Home default dock before FK5-R5 raise (bottom-left at max Y). */
export function homeLowDockForkinatorPosition(bounds: ForkinatorBounds): ForkinatorPosition {
  const x = bounds.insetLeft + FORKINATOR_DEFAULT_LEFT_INSET_PX;
  const y = maxForkinatorPositionY(bounds);
  return clampForkinatorPosition({ x, y }, bounds);
}

/** Home default: upper-left dock (0% rect overlap with Home controls at 320×640 / 390×844). */
export function defaultForkinatorPosition(bounds: ForkinatorBounds): ForkinatorPosition {
  const x = bounds.insetLeft + FORKINATOR_DEFAULT_LEFT_INSET_PX;
  const innerHeight = bounds.height - bounds.insetTop - bounds.insetBottom;
  const fraction =
    innerHeight < 600
      ? FORKINATOR_HOME_DOCK_TOP_OFFSET_FRACTION_SHORT
      : FORKINATOR_HOME_DOCK_TOP_OFFSET_FRACTION_TALL;
  let y = bounds.insetTop + Math.round(innerHeight * fraction);
  /** Expo web often reports 0 top inset; use screen-height anchors from Playwright sweeps. */
  if (bounds.insetTop < 12) {
    const screenFraction = bounds.height < 700 ? 0.369 : 0.256;
    y = Math.round(bounds.height * screenFraction);
  }
  return clampForkinatorPosition({ x, y }, bounds);
}

/** FK5 post-merge raised bottom-left Home dock (78b82eb) for epoch migration. */
export function homeRaisedBottomLeftForkinatorPosition(bounds: ForkinatorBounds): ForkinatorPosition {
  const x = bounds.insetLeft + FORKINATOR_DEFAULT_LEFT_INSET_PX;
  const maxY = maxForkinatorPositionY(bounds);
  const innerHeight = bounds.height - bounds.insetTop - bounds.insetBottom;
  const seeMoreTop = bounds.insetTop + Math.round(innerHeight * 0.68);
  const maxHomeMascotY =
    seeMoreTop - FORKINATOR_HIT_INSET_TOP_PX - FORKINATOR_HIT_HEIGHT_PX - 8;
  const minHomeMascotY = bounds.insetTop + Math.round(innerHeight * 0.34);
  const raisePx = Math.max(194, Math.round(innerHeight * 0.34));
  const raisedY = maxY - raisePx;
  let y = Math.min(maxHomeMascotY, Math.max(minHomeMascotY, raisedY));
  y = Math.min(maxY, Math.max(bounds.insetTop, y));
  return clampForkinatorPosition({ x, y }, bounds);
}

function isStoredUnmovedHomeLeftDock(
  stored: ForkinatorPosition,
  bounds: ForkinatorBounds,
): boolean {
  const homeX = bounds.insetLeft + FORKINATOR_DEFAULT_LEFT_INSET_PX;
  if (Math.abs(stored.x - homeX) > FORKINATOR_LEGACY_DOCK_ZONE_TOLERANCE_X_PX) {
    return false;
  }
  const candidates = [
    homeLowDockForkinatorPosition(bounds),
    homeRaisedBottomLeftForkinatorPosition(bounds),
    defaultForkinatorPosition(bounds),
  ];
  return candidates.some(
    (candidate) =>
      Math.abs(stored.y - candidate.y) <= FORKINATOR_LEGACY_DOCK_ZONE_TOLERANCE_Y_PX,
  );
}

export function defaultForkinatorPositionForTab(
  bounds: ForkinatorBounds,
  isHome: boolean,
): ForkinatorPosition {
  return isHome ? defaultForkinatorPosition(bounds) : legacyDefaultForkinatorPosition(bounds);
}

export function clampForkinatorPosition(
  position: ForkinatorPosition,
  bounds: ForkinatorBounds,
): ForkinatorPosition {
  const minX = bounds.insetLeft;
  const maxX = maxForkinatorPositionX(bounds);
  const minY = bounds.insetTop;
  const maxY = Math.max(minY, maxForkinatorPositionY(bounds));
  return {
    x: Math.min(maxX, Math.max(minX, position.x)),
    y: Math.min(maxY, Math.max(minY, position.y)),
  };
}

export function readForkinatorPosition(): ForkinatorPosition | null {
  const raw = readJson<ForkinatorPosition | null>(FORKINATOR_POSITION_STORAGE_KEY, null);
  if (!raw || typeof raw.x !== 'number' || typeof raw.y !== 'number') return null;
  if (!Number.isFinite(raw.x) || !Number.isFinite(raw.y)) return null;
  return raw;
}

export function writeForkinatorPosition(position: ForkinatorPosition): void {
  writeJson(FORKINATOR_POSITION_STORAGE_KEY, position);
}

function readForkinatorPositionEpoch(): number {
  const raw = readJson<number | null>(FORKINATOR_POSITION_EPOCH_KEY, null);
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 1;
  return raw;
}

function writeForkinatorPositionEpoch(epoch: number): void {
  writeJson(FORKINATOR_POSITION_EPOCH_KEY, epoch);
}

/**
 * True when a stored position is still on (or jitter-near) the legacy bottom-right dock,
 * including positions saved at a different viewport height (FK5-4).
 */
export function isStoredPositionInLegacyDockZone(
  stored: ForkinatorPosition,
  bounds: ForkinatorBounds,
): boolean {
  const legacy = legacyDefaultForkinatorPosition(bounds);
  if (
    Math.abs(stored.x - legacy.x) <= FORKINATOR_LEGACY_DOCK_ZONE_TOLERANCE_X_PX &&
    Math.abs(stored.y - legacy.y) <= FORKINATOR_LEGACY_DOCK_ZONE_TOLERANCE_Y_PX
  ) {
    return true;
  }
  const maxX = maxForkinatorPositionX(bounds);
  const maxY = maxForkinatorPositionY(bounds);
  return (
    stored.x >= maxX - FORKINATOR_LEGACY_DOCK_ZONE_TOLERANCE_X_PX &&
    stored.y >= maxY - FORKINATOR_LEGACY_DOCK_ZONE_TOLERANCE_Y_PX
  );
}

/**
 * Returns a stored position, migrating unmoved mascots from the legacy default to the new dock.
 */
export function resolveForkinatorPosition(bounds: ForkinatorBounds): ForkinatorPosition | null {
  const stored = readForkinatorPosition();
  if (!stored) return null;

  const epoch = readForkinatorPositionEpoch();
  if (epoch >= FORKINATOR_POSITION_EPOCH) {
    return stored;
  }

  const shouldMigrate =
    isStoredPositionInLegacyDockZone(stored, bounds) ||
    isStoredUnmovedHomeLeftDock(stored, bounds);

  if (!shouldMigrate) {
    writeForkinatorPositionEpoch(FORKINATOR_POSITION_EPOCH);
    return stored;
  }

  const migrated = defaultForkinatorPosition(bounds);
  writeForkinatorPosition(migrated);
  writeForkinatorPositionEpoch(FORKINATOR_POSITION_EPOCH);
  return migrated;
}
