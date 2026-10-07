import { FORKINATOR_SCANNER_NUDGE_MESSAGE } from './scannerNudgeCopy';
import {
  THINKING_BUBBLE_MASCOT_GAP,
  THINKING_BUBBLE_TAIL_GAP,
  THINKING_BUBBLE_TAIL_HEIGHT,
} from './thinkingBubbleLayout';

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

export type ScannerPromptPlacement = 'above' | 'below';

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
): {
  bodyWidth: number;
  bodyHeight: number;
} {
  const maxBodyWidth = Math.min(
    SCANNER_PROMPT_MAX_WIDTH,
    screenInnerWidth - SCANNER_PROMPT_SCREEN_EDGE_INSET * 2,
  );
  const bodyWidth = maxBodyWidth;
  const contentWidth = bodyWidth - SCANNER_PROMPT_HORIZONTAL_PADDING * 2;
  const lines = estimateMessageLineCount(message, contentWidth);
  const textHeight = lines * SCANNER_PROMPT_LINE_HEIGHT;
  const buttonBlock = includeCameraButton ? SCANNER_PROMPT_CAMERA_BUTTON_BLOCK_HEIGHT : 0;
  const bodyHeight = textHeight + SCANNER_PROMPT_VERTICAL_PADDING * 2 + buttonBlock;
  return { bodyWidth, bodyHeight };
}

export function scannerPromptFootprint(input: {
  screenWidth: number;
  insetLeft: number;
  insetRight: number;
  message?: string;
  includeCameraButton?: boolean;
}): { width: number; height: number; bodyWidth: number; bodyHeight: number } {
  const screenInnerWidth = input.screenWidth - input.insetLeft - input.insetRight;
  const { bodyWidth, bodyHeight } = scannerPromptBodySize(
    screenInnerWidth,
    input.message,
    input.includeCameraButton,
  );
  const tailBlock = THINKING_BUBBLE_TAIL_HEIGHT + THINKING_BUBBLE_TAIL_GAP;
  return {
    width: bodyWidth,
    height: bodyHeight + tailBlock,
    bodyWidth,
    bodyHeight,
  };
}

export function layoutScannerPrompt(input: ScannerPromptLayoutInput): ScannerPromptLayout {
  const message = input.message ?? FORKINATOR_SCANNER_NUDGE_MESSAGE;
  const { width: bubbleWidth, height: bubbleHeight, bodyWidth, bodyHeight } =
    scannerPromptFootprint({
      screenWidth: input.screenWidth,
      insetLeft: input.insetLeft,
      insetRight: input.insetRight,
      message,
      includeCameraButton: input.includeCameraButton,
    });
  const mascotCenterX = input.mascotX + input.mascotWidth / 2;

  let placement: ScannerPromptPlacement = 'above';
  let top = input.mascotY - bubbleHeight - THINKING_BUBBLE_MASCOT_GAP;
  const minTop = input.insetTop;
  const maxTop = input.screenHeight - input.insetBottom - bubbleHeight;

  if (top < minTop) {
    placement = 'below';
    top = input.mascotY + input.mascotHeight + THINKING_BUBBLE_MASCOT_GAP;
  }

  if (top > maxTop) {
    top = Math.min(maxTop, Math.max(minTop, top));
  }

  let left = mascotCenterX - bubbleWidth / 2;
  const minLeft = input.insetLeft;
  const maxLeft = input.screenWidth - input.insetRight - bubbleWidth;
  left = Math.min(maxLeft, Math.max(minLeft, left));

  return {
    left,
    top,
    placement,
    width: bubbleWidth,
    height: bubbleHeight,
    bodyWidth,
    bodyHeight,
  };
}
