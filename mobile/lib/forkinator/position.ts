import { readJson, writeJson } from '../storage';
import {
  FORKINATOR_HIT_HEIGHT_PX,
  FORKINATOR_HIT_INSET_TOP_PX,
} from './hitArea';
import { FORKINATOR_TAB_BAR_HEIGHT_PX } from './forkinatorTabBar';
export const FORKINATOR_POSITION_STORAGE_KEY = 'mealprep.forkinator.position';
export const FORKINATOR_POSITION_EPOCH_KEY = 'mealprep.forkinator.positionEpoch';
/** Bump when the default dock changes so unmoved mascots can migrate. */
export const FORKINATOR_POSITION_EPOCH = 2;

/** Full-body mascot display size (matches asset aspect ratio ~0.365 width:height). */
export const FORKINATOR_WIDTH_PX = 44;
export const FORKINATOR_HEIGHT_PX = 120;
export const FORKINATOR_ASPECT_WIDTH_TO_HEIGHT = FORKINATOR_WIDTH_PX / FORKINATOR_HEIGHT_PX;

/** Default dock on Home: above the tab bar, hugging the left edge. */
export const FORKINATOR_DEFAULT_LEFT_INSET_PX = 8;
/** Default dock on other tabs: hugging the right edge. */
export const FORKINATOR_DEFAULT_RIGHT_INSET_PX = 8;
export const FORKINATOR_DEFAULT_BOTTOM_MARGIN_PX = 16;

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
  const y = maxForkinatorPositionY(bounds);
  return clampForkinatorPosition({ x, y }, bounds);
}

/** Home default: bottom-left dock (compact pill keeps controls clear). */
export function defaultForkinatorPosition(bounds: ForkinatorBounds): ForkinatorPosition {
  const x = bounds.insetLeft + FORKINATOR_DEFAULT_LEFT_INSET_PX;
  const y = maxForkinatorPositionY(bounds);
  return clampForkinatorPosition({ x, y }, bounds);
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

  if (!isStoredPositionInLegacyDockZone(stored, bounds)) {
    writeForkinatorPositionEpoch(FORKINATOR_POSITION_EPOCH);
    return stored;
  }

  const migrated = defaultForkinatorPosition(bounds);
  writeForkinatorPosition(migrated);
  writeForkinatorPositionEpoch(FORKINATOR_POSITION_EPOCH);
  return migrated;
}
