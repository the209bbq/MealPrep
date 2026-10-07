export const THINKING_BUBBLE_CLOUD_WIDTH = 58;
export const THINKING_BUBBLE_CLOUD_HEIGHT = 34;
export const THINKING_BUBBLE_TAIL_GAP = 4;
export const THINKING_BUBBLE_MASCOT_GAP = 6;

/** Vertical space for tail circles below/above the cloud. */
export const THINKING_BUBBLE_TAIL_HEIGHT = 22;

export type ThinkingBubblePlacement = 'above' | 'below';

export type ThinkingBubbleLayout = {
  left: number;
  top: number;
  placement: ThinkingBubblePlacement;
  width: number;
  height: number;
};

export type ThinkingBubbleLayoutInput = {
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
};

export function thinkingBubbleFootprint(): { width: number; height: number } {
  return {
    width: THINKING_BUBBLE_CLOUD_WIDTH,
    height: THINKING_BUBBLE_CLOUD_HEIGHT + THINKING_BUBBLE_TAIL_HEIGHT + THINKING_BUBBLE_TAIL_GAP,
  };
}

export function layoutThinkingBubble(input: ThinkingBubbleLayoutInput): ThinkingBubbleLayout {
  const { width: bubbleWidth, height: bubbleHeight } = thinkingBubbleFootprint();
  const mascotCenterX = input.mascotX + input.mascotWidth / 2;

  let placement: ThinkingBubblePlacement = 'above';
  let top =
    input.mascotY - bubbleHeight - THINKING_BUBBLE_MASCOT_GAP;
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
  };
}
