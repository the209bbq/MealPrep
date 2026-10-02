import { GUEST_SAVE_NUDGE_CONFIG } from '../../config/guestSaveNudge';
import { readJson, writeJson } from '../storage';

export function readGuestSaveNudgeDismissedAt(): number | null {
  const value = readJson<number | null>(GUEST_SAVE_NUDGE_CONFIG.storageKey, null);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function writeGuestSaveNudgeDismissedAt(dismissedAtMs: number): void {
  writeJson(GUEST_SAVE_NUDGE_CONFIG.storageKey, dismissedAtMs);
}
