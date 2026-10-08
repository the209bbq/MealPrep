import { FORKINATOR_FORK_IN_ROAD_MESSAGE } from './forkInRoadPromptCopy';
import {
  defaultForkinatorPosition,
  type ForkinatorBounds,
} from './position';
import { layoutScannerPrompt } from './scannerPromptLayout';

export type ForkinatorRect = { left: number; top: number; width: number; height: number };

/** Fork-in-the-road cloud bounds at the default dock (for layout regression checks). */
export function forkInRoadCloudBoundsAtDefaultDock(bounds: ForkinatorBounds): ForkinatorRect {
  const position = defaultForkinatorPosition(bounds);
  const layout = layoutScannerPrompt({
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
    message: FORKINATOR_FORK_IN_ROAD_MESSAGE,
    includeActionButton: true,
  });
  return {
    left: layout.left,
    top: layout.top,
    width: layout.width,
    height: layout.height,
  };
}
