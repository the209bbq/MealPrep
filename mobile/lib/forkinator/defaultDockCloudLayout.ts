import {
  FORK_IN_ROAD_PILL_MIN_WIDTH_PX,
  layoutForkInRoadPill,
} from './forkInRoadPillLayout';
import {
  defaultForkinatorPosition,
  type ForkinatorBounds,
} from './position';

export type ForkinatorRect = { left: number; top: number; width: number; height: number };

/** Collapsed fork-in-the-road pill at the Home default dock (layout regression checks). */
export function forkInRoadPillBoundsAtDefaultDock(bounds: ForkinatorBounds): ForkinatorRect {
  const position = defaultForkinatorPosition(bounds);
  const layout = layoutForkInRoadPill({
    mascotX: position.x,
    mascotY: position.y,
    mascotWidth: bounds.mascotWidth,
    mascotHeight: bounds.mascotHeight,
    screenWidth: bounds.width,
    screenHeight: bounds.height,
    insetTop: bounds.insetTop,
    insetRight: bounds.insetRight,
    insetBottom: bounds.insetBottom,
    insetLeft: bounds.insetLeft,
    pillWidth: FORK_IN_ROAD_PILL_MIN_WIDTH_PX,
  });
  return {
    left: layout.left,
    top: layout.top,
    width: layout.width,
    height: layout.height,
  };
}

/** @deprecated Use forkInRoadPillBoundsAtDefaultDock — full cloud is expand-only now. */
export function forkInRoadCloudBoundsAtDefaultDock(bounds: ForkinatorBounds): ForkinatorRect {
  return forkInRoadPillBoundsAtDefaultDock(bounds);
}
