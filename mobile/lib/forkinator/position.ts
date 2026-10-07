import { readJson, writeJson } from '../storage';

export const FORKINATOR_POSITION_STORAGE_KEY = 'mealprep.forkinator.position';

/** Full-body mascot display size (matches asset aspect ratio ~0.365 width:height). */
export const FORKINATOR_WIDTH_PX = 44;
export const FORKINATOR_HEIGHT_PX = 120;
export const FORKINATOR_ASPECT_WIDTH_TO_HEIGHT = FORKINATOR_WIDTH_PX / FORKINATOR_HEIGHT_PX;

/** Default dock: above the bottom tab bar, hugging the right edge. */
export const FORKINATOR_DEFAULT_RIGHT_INSET_PX = 8;
export const FORKINATOR_DEFAULT_BOTTOM_MARGIN_PX = 16;

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

export function defaultForkinatorPosition(bounds: ForkinatorBounds): ForkinatorPosition {
  const x =
    bounds.width -
    bounds.insetRight -
    bounds.mascotWidth -
    FORKINATOR_DEFAULT_RIGHT_INSET_PX;
  const y =
    bounds.height -
    bounds.insetBottom -
    bounds.mascotHeight -
    FORKINATOR_DEFAULT_BOTTOM_MARGIN_PX;
  return clampForkinatorPosition({ x, y }, bounds);
}

export function clampForkinatorPosition(
  position: ForkinatorPosition,
  bounds: ForkinatorBounds,
): ForkinatorPosition {
  const minX = bounds.insetLeft;
  const maxX = Math.max(minX, bounds.width - bounds.insetRight - bounds.mascotWidth);
  const minY = bounds.insetTop;
  const maxY = Math.max(minY, bounds.height - bounds.insetBottom - bounds.mascotHeight);
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
