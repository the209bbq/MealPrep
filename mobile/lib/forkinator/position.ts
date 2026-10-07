import { readJson, writeJson } from '../storage';

export const FORKINATOR_POSITION_STORAGE_KEY = 'mealprep.forkinator.position';

export const FORKINATOR_SIZE_PX = 60;

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
  size: number;
};

export function defaultForkinatorPosition(bounds: ForkinatorBounds): ForkinatorPosition {
  const innerHeight = bounds.height - bounds.insetTop - bounds.insetBottom;
  const x = bounds.width - bounds.insetRight - bounds.size - 8;
  const y = bounds.insetTop + innerHeight / 2 - bounds.size / 2;
  return clampForkinatorPosition({ x, y }, bounds);
}

export function clampForkinatorPosition(
  position: ForkinatorPosition,
  bounds: ForkinatorBounds,
): ForkinatorPosition {
  const minX = bounds.insetLeft;
  const maxX = Math.max(minX, bounds.width - bounds.insetRight - bounds.size);
  const minY = bounds.insetTop;
  const maxY = Math.max(minY, bounds.height - bounds.insetBottom - bounds.size);
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
