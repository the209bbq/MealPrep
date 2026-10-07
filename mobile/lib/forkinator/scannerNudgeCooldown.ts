import { readJson, writeJson } from '../storage';

/** Minimum time between scanner nudge message displays for users who have not scanned yet. */
export const FORKINATOR_SCANNER_NUDGE_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

export const FORKINATOR_SCANNER_NUDGE_LAST_SHOWN_STORAGE_KEY =
  'mealprep.forkinator.scannerNudgeLastShownAt';

export function readForkinatorScannerNudgeLastShownAt(): number | null {
  const raw = readJson<number | null>(FORKINATOR_SCANNER_NUDGE_LAST_SHOWN_STORAGE_KEY, null);
  if (raw == null || typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  return raw;
}

export function writeForkinatorScannerNudgeLastShownAt(timestampMs: number): void {
  writeJson(FORKINATOR_SCANNER_NUDGE_LAST_SHOWN_STORAGE_KEY, timestampMs);
}

export function markForkinatorScannerNudgeShown(nowMs: number = Date.now()): void {
  writeForkinatorScannerNudgeLastShownAt(nowMs);
}

/** Delay after the mascot is ready before auto-showing the scanner speech prompt. */
export const FORKINATOR_SCANNER_PROMPT_AUTO_SHOW_DELAY_MS = 2000;

export function shouldShowForkinatorScannerNudge(
  hasScanned: boolean,
  nowMs: number = Date.now(),
  lastShownAtMs: number | null = readForkinatorScannerNudgeLastShownAt(),
): boolean {
  if (hasScanned) return false;
  if (lastShownAtMs == null) return true;
  return nowMs - lastShownAtMs >= FORKINATOR_SCANNER_NUDGE_COOLDOWN_MS;
}

export function shouldAutoShowForkinatorScannerPrompt(
  hasScanned: boolean,
  nowMs: number = Date.now(),
  lastShownAtMs: number | null = readForkinatorScannerNudgeLastShownAt(),
): boolean {
  return shouldShowForkinatorScannerNudge(hasScanned, nowMs, lastShownAtMs);
}

export type ForkinatorMascotTapAction = 'dismissScannerPrompt' | 'toggleThinkingBubble';

export function resolveForkinatorMascotTapAction(
  scannerPromptVisible: boolean,
): ForkinatorMascotTapAction {
  return scannerPromptVisible ? 'dismissScannerPrompt' : 'toggleThinkingBubble';
}
