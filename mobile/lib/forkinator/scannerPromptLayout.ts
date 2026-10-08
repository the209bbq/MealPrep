import { FORKINATOR_SCANNER_NUDGE_MESSAGE } from './scannerNudgeCopy';
import { FORKINATOR_TAB_BAR_HEIGHT_PX } from './forkinatorTabBar';

/** Gap between the cloud's tail and Forky. */
export const PROMPT_BUBBLE_MASCOT_GAP = 6;
/** Gap between the cloud body and its tail circles. */
export const PROMPT_BUBBLE_TAIL_GAP = 4;
/** Tail circles (10+7+5) plus inter-circle margins (3+3). */
export const PROMPT_BUBBLE_TAIL_HEIGHT = 28;
/** Narrowest cloud body allowed when squeezing a bubble beside Forky. */
export const PROMPT_BUBBLE_MIN_SIDE_BODY_WIDTH = 140;

export const SCANNER_PROMPT_HORIZONTAL_PADDING = 10;
export const SCANNER_PROMPT_VERTICAL_PADDING = 8;
export const SCANNER_PROMPT_FONT_SIZE = 12;
export const SCANNER_PROMPT_LINE_HEIGHT = 16;
export const SCANNER_PROMPT_MAX_WIDTH = 220;
export const SCANNER_PROMPT_SCREEN_EDGE_INSET = 8;
export const SCANNER_PROMPT_BORDER_RADIUS = 16;
export const SCANNER_PROMPT_CAMERA_BUTTON_HEIGHT = 28;
export const SCANNER_PROMPT_CAMERA_BUTTON_MARGIN_TOP = 6;
export const SCANNER_PROMPT_CAMERA_BUTTON_BLOCK_HEIGHT =
  SCANNER_PROMPT_CAMERA_BUTTON_HEIGHT + SCANNER_PROMPT_CAMERA_BUTTON_MARGIN_TOP;

/** Where the cloud sits relative to Forky; it never covers his body. */
export type ScannerPromptPlacement = 'above' | 'left' | 'right' | 'below';

export type ScannerPromptLayout = {
  left: number;
  top: number;
  placement: ScannerPromptPlacement;
  width: number;
  height: number;
  bodyWidth: number;
  bodyHeight: number;
};

export type ScannerPromptLayoutInput = {
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
  message?: string;
  includeCameraButton?: boolean;
  includeActionButton?: boolean;
  /** When true, skip the above placement (grocery aisle cloud — FK5-3). */
  preferSideOverAbove?: boolean;
};

function estimateMessageLineCount(message: string, contentWidth: number): number {
  const avgCharWidth = 5.8;
  const charsPerLine = Math.max(8, Math.floor(contentWidth / avgCharWidth));
  return Math.max(1, Math.ceil(message.length / charsPerLine));
}

export function scannerPromptBodySize(
  screenInnerWidth: number,
  message: string = FORKINATOR_SCANNER_NUDGE_MESSAGE,
  includeCameraButton = false,
  includeActionButton = includeCameraButton,
): {
  bodyWidth: number;
  bodyHeight: number;
} {
  const maxBodyWidth = Math.min(
    SCANNER_PROMPT_MAX_WIDTH,
    screenInnerWidth - SCANNER_PROMPT_SCREEN_EDGE_INSET * 2,
  );
  return scannerPromptBodySizeForWidth(maxBodyWidth, message, includeActionButton);
}

export function scannerPromptBodySizeForWidth(
  bodyWidth: number,
  message: string = FORKINATOR_SCANNER_NUDGE_MESSAGE,
  includeActionButton = false,
): { bodyWidth: number; bodyHeight: number } {
  const contentWidth = bodyWidth - SCANNER_PROMPT_HORIZONTAL_PADDING * 2;
  const lines = estimateMessageLineCount(message, contentWidth);
  const textHeight = lines * SCANNER_PROMPT_LINE_HEIGHT;
  const buttonBlock = includeActionButton ? SCANNER_PROMPT_CAMERA_BUTTON_BLOCK_HEIGHT : 0;
  const bodyHeight = textHeight + SCANNER_PROMPT_VERTICAL_PADDING * 2 + buttonBlock;
  return { bodyWidth, bodyHeight };
}

export function scannerPromptFootprint(input: {
  screenWidth: number;
  insetLeft: number;
  insetRight: number;
  message?: string;
  includeCameraButton?: boolean;
  includeActionButton?: boolean;
}): { width: number; height: number; bodyWidth: number; bodyHeight: number } {
  const screenInnerWidth = input.screenWidth - input.insetLeft - input.insetRight;
  const { bodyWidth, bodyHeight } = scannerPromptBodySize(
    screenInnerWidth,
    input.message,
    input.includeActionButton ?? input.includeCameraButton,
  );
  const tailBlock = PROMPT_BUBBLE_TAIL_HEIGHT + PROMPT_BUBBLE_TAIL_GAP;
  return {
    width: bodyWidth,
    height: bodyHeight + tailBlock,
    bodyWidth,
    bodyHeight,
  };
}

type Rect = { left: number; top: number; width: number; height: number };

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(min, max), Math.max(min, value));
}

/**
 * Place a text cloud fully ABOVE Forky's head, else OFF TO THE SIDE (whichever side has room),
 * else below him — never over his body, always on-screen, and clear of the bottom tab bar.
 */
export function layoutScannerPrompt(input: ScannerPromptLayoutInput): ScannerPromptLayout {
  const message = input.message ?? FORKINATOR_SCANNER_NUDGE_MESSAGE;
  const includeActionButton = input.includeActionButton ?? input.includeCameraButton ?? false;
  const { bodyWidth, bodyHeight } = scannerPromptFootprint({
    screenWidth: input.screenWidth,
    insetLeft: input.insetLeft,
    insetRight: input.insetRight,
    message,
    includeActionButton,
  });
  const tailBlock = PROMPT_BUBBLE_TAIL_HEIGHT + PROMPT_BUBBLE_TAIL_GAP;
  const gap = PROMPT_BUBBLE_MASCOT_GAP;
  const edge = SCANNER_PROMPT_SCREEN_EDGE_INSET;
  const minLeft = input.insetLeft + edge;
  const maxRight = input.screenWidth - input.insetRight - edge;
  const minTop = input.insetTop + edge;
  const maxBottom =
    input.screenHeight - input.insetBottom - FORKINATOR_TAB_BAR_HEIGHT_PX - edge;
  const mascot: Rect = {
    left: input.mascotX,
    top: input.mascotY,
    width: input.mascotWidth,
    height: input.mascotHeight,
  };
  const mascotCenterX = input.mascotX + input.mascotWidth / 2;

  const aboveHeight = bodyHeight + tailBlock;
  const aboveTop = input.mascotY - gap - aboveHeight;

  const trySidePlacement = (): ScannerPromptLayout | null => {
  const roomRight = maxRight - (input.mascotX + input.mascotWidth + gap) - tailBlock;
  const roomLeft = input.mascotX - gap - tailBlock - minLeft;
  const sides: { placement: 'left' | 'right'; room: number }[] = [
    { placement: 'right' as const, room: roomRight },
    { placement: 'left' as const, room: roomLeft },
  ].sort((a, b) => b.room - a.room);
    for (const side of sides) {
      const sideBodyWidth = Math.min(bodyWidth, Math.floor(side.room));
      if (sideBodyWidth < PROMPT_BUBBLE_MIN_SIDE_BODY_WIDTH) continue;
      const sized = scannerPromptBodySizeForWidth(sideBodyWidth, message, includeActionButton);
      const width = sized.bodyWidth + tailBlock;
      const height = sized.bodyHeight;
      if (height > maxBottom - minTop) continue;
      const left =
        side.placement === 'right'
          ? input.mascotX + input.mascotWidth + gap
          : input.mascotX - gap - width;
      const top = clamp(input.mascotY, minTop, maxBottom - height);
      return {
        left,
        top,
        placement: side.placement,
        width,
        height,
        bodyWidth: sized.bodyWidth,
        bodyHeight: sized.bodyHeight,
      };
    }
    return null;
  };

  if (!input.preferSideOverAbove) {
    // 1) Above his head (preferred).
    if (aboveTop >= minTop) {
      return {
        left: clamp(mascotCenterX - bodyWidth / 2, minLeft, maxRight - bodyWidth),
        top: aboveTop,
        placement: 'above',
        width: bodyWidth,
        height: aboveHeight,
        bodyWidth,
        bodyHeight,
      };
    }
  }

  // 2) Off to the side, preferring the roomier side; squeeze the cloud if needed.
  const sideLayout = trySidePlacement();
  if (sideLayout) return sideLayout;

  if (input.preferSideOverAbove && aboveTop >= minTop) {
    return {
      left: clamp(mascotCenterX - bodyWidth / 2, minLeft, maxRight - bodyWidth),
      top: aboveTop,
      placement: 'above',
      width: bodyWidth,
      height: aboveHeight,
      bodyWidth,
      bodyHeight,
    };
  }

  // 3) Below his feet when there is room above the tab bar.
  const belowTop = input.mascotY + input.mascotHeight + gap;
  if (belowTop + aboveHeight <= maxBottom) {
    return {
      left: clamp(mascotCenterX - bodyWidth / 2, minLeft, maxRight - bodyWidth),
      top: belowTop,
      placement: 'below',
      width: bodyWidth,
      height: aboveHeight,
      bodyWidth,
      bodyHeight,
    };
  }

  // 4) Last resort (tiny screens): pin to the top edge above him, shifted off his body.
  const fallback: Rect = {
    left: clamp(mascotCenterX - bodyWidth / 2, minLeft, maxRight - bodyWidth),
    top: minTop,
    width: bodyWidth,
    height: aboveHeight,
  };
  if (rectsOverlap(fallback, mascot)) {
    const leftOfMascot = input.mascotX - gap - bodyWidth;
    const rightOfMascot = input.mascotX + input.mascotWidth + gap;
    fallback.left =
      rightOfMascot + bodyWidth <= maxRight
        ? rightOfMascot
        : leftOfMascot >= minLeft
          ? leftOfMascot
          : fallback.left;
  }
  return { ...fallback, placement: 'above', bodyWidth, bodyHeight };
}
