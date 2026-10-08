import { FORKINATOR_TAB_BAR_HEIGHT_PX } from './forkinatorTabBar';

/** Compact pill beside Forky on Home (collapsed fork-in-the-road). */
export const FORK_IN_ROAD_PILL_HEIGHT_PX = 32;
export const FORK_IN_ROAD_PILL_MIN_WIDTH_PX = 108;
export const FORK_IN_ROAD_PILL_HORIZONTAL_PADDING_PX = 10;
export const FORK_IN_ROAD_PILL_GAP_FROM_MASCOT_PX = 6;
export const FORK_IN_ROAD_PILL_SCREEN_EDGE_INSET_PX = 8;
/** Pill must sit within this distance (px) of the mascot box edge (anchored to Forky). */
export const FORK_IN_ROAD_PILL_MAX_ANCHOR_DISTANCE_PX = 12;

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
 * Pill anchored to Forky: beside (preferred) or directly above his head — never screen-far.
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
    return {
      left: clamp(mascotCenterX - pillWidth / 2, minLeft, maxRight - pillWidth),
      top: aboveTop,
      width: pillWidth,
      height: pillHeight,
    };
  }

  const besideLeft = input.mascotX + input.mascotWidth + gap;
  if (besideLeft + pillWidth <= maxRight) {
    const top = clamp(input.mascotY + 4, minTop, maxBottom - pillHeight);
    return { left: besideLeft, top, width: pillWidth, height: pillHeight };
  }

  const leftLeft = input.mascotX - gap - pillWidth;
  const left = leftLeft >= minLeft ? leftLeft : minLeft;
  const top = clamp(input.mascotY + 4, minTop, maxBottom - pillHeight);
  return { left, top, width: pillWidth, height: pillHeight };
}

export function isForkInRoadPillAnchoredToMascot(
  pill: ForkInRoadPillLayout,
  input: ForkInRoadPillLayoutInput,
): boolean {
  const gap = FORK_IN_ROAD_PILL_GAP_FROM_MASCOT_PX;
  const maxD = FORK_IN_ROAD_PILL_MAX_ANCHOR_DISTANCE_PX;
  const mascotRight = input.mascotX + input.mascotWidth;
  const mascotBottom = input.mascotY + input.mascotHeight;
  const pillRight = pill.left + pill.width;
  const pillBottom = pill.top + pill.height;

  const beside =
    Math.abs(pill.left - (mascotRight + gap)) <= maxD &&
    pill.top >= input.mascotY - maxD &&
    pill.top <= input.mascotY + 24;

  const above =
    Math.abs(pillBottom - (input.mascotY - gap)) <= maxD &&
    pill.left + pill.width >= input.mascotX - maxD &&
    pill.left <= mascotRight + maxD;

  return beside || above;
}
