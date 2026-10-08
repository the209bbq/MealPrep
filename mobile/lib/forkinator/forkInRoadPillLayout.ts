import { FORKINATOR_TAB_BAR_HEIGHT_PX } from './forkinatorTabBar';

/** Compact pill beside Forky on Home (collapsed fork-in-the-road). */
export const FORK_IN_ROAD_PILL_HEIGHT_PX = 32;
export const FORK_IN_ROAD_PILL_MIN_WIDTH_PX = 108;
export const FORK_IN_ROAD_PILL_HORIZONTAL_PADDING_PX = 10;
export const FORK_IN_ROAD_PILL_GAP_FROM_MASCOT_PX = 6;
export const FORK_IN_ROAD_PILL_SCREEN_EDGE_INSET_PX = 8;

export type ForkInRoadPillLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ForkInRoadPillLayoutInput = {
  mascotX: number;
  mascotY: number;
  mascotWidth: number;
  mascotHeight: number;
  screenWidth: number;
  screenHeight: number;
  insetTop: number;
  insetRight: number;
  insetBottom: number;
  insetLeft: number;
  pillWidth: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(min, max), Math.max(min, value));
}

/**
 * Places the pill above Forky's head when there is room (clears category chips), else beside him.
 */
export function layoutForkInRoadPill(input: ForkInRoadPillLayoutInput): ForkInRoadPillLayout {
  const edge = FORK_IN_ROAD_PILL_SCREEN_EDGE_INSET_PX;
  const gap = FORK_IN_ROAD_PILL_GAP_FROM_MASCOT_PX;
  const pillWidth = Math.max(FORK_IN_ROAD_PILL_MIN_WIDTH_PX, input.pillWidth);
  const pillHeight = FORK_IN_ROAD_PILL_HEIGHT_PX;
  const minLeft = input.insetLeft + edge;
  const maxRight = input.screenWidth - input.insetRight - edge;
  const minTop = input.insetTop + edge;
  const maxBottom =
    input.screenHeight - input.insetBottom - FORKINATOR_TAB_BAR_HEIGHT_PX - edge;
  const mascotCenterX = input.mascotX + input.mascotWidth / 2;

  const aboveTop = input.mascotY - gap - pillHeight;
  if (aboveTop >= minTop) {
    const rightDockedPillLeft = maxRight - pillWidth;
    const left = clamp(rightDockedPillLeft, minLeft, maxRight - pillWidth);
    return { left, top: aboveTop, width: pillWidth, height: pillHeight };
  }

  const rightLeft = input.mascotX + input.mascotWidth + gap;
  if (rightLeft + pillWidth <= maxRight) {
    const top = clamp(input.mascotY + 4, minTop, maxBottom - pillHeight);
    return { left: rightLeft, top, width: pillWidth, height: pillHeight };
  }

  const leftLeft = input.mascotX - gap - pillWidth;
  const left = leftLeft >= minLeft ? leftLeft : minLeft;
  const top = clamp(input.mascotY + 4, minTop, maxBottom - pillHeight);
  return { left, top, width: pillWidth, height: pillHeight };
}
