/** Max pointer travel (px) to still count as a tap, not a drag. */
export const FORKINATOR_TAP_MOVE_THRESHOLD_PX = 6;

/** Max press duration (ms) to count as a tap. */
export const FORKINATOR_TAP_MAX_DURATION_MS = 450;

/** Ignore synthetic click after pointer-up tap so web does not activate twice. */
export const FORKINATOR_WEB_POINTER_ACTIVATE_DEDUPE_MS = 600;

export function isForkinatorTapRelease(
  dx: number,
  dy: number,
  durationMs: number,
  moveThresholdPx = FORKINATOR_TAP_MOVE_THRESHOLD_PX,
  maxDurationMs = FORKINATOR_TAP_MAX_DURATION_MS,
): boolean {
  const distance = Math.hypot(dx, dy);
  return distance < moveThresholdPx && durationMs >= 0 && durationMs <= maxDurationMs;
}
