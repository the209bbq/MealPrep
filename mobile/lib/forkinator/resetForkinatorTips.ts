import { listStorageKeysWithPrefix, removeStorageKey } from '../storage';
import {
  FORKINATOR_AISLE_SORT_PROMPT_LAST_SHOWN_DAY_KEY,
  FORKINATOR_AISLE_SORT_USED_STORAGE_KEY,
} from './aisleSortPrompt';
import {
  FORKINATOR_EXPIRATION_PROMPT_LAST_FINGERPRINT_KEY,
  FORKINATOR_EXPIRATION_PROMPT_LAST_SHOWN_DAY_KEY,
} from './expirationPrompt';
import {
  FORKINATOR_FORK_IN_ROAD_COOLDOWN_UNTIL_DAY_KEY,
  FORKINATOR_FORK_IN_ROAD_CONSECUTIVE_DISMISSALS_KEY,
  FORKINATOR_FORK_IN_ROAD_LAST_SHOWN_DAY_KEY,
} from './forkInRoadPrompt';
import { FORKINATOR_GREETING_SHOWN_STORAGE_KEY } from './greetingShown';
import { FORKINATOR_SCANNER_NUDGE_LAST_SHOWN_STORAGE_KEY } from './scannerNudgeCooldown';
import { emitForkinatorTipsReset } from './resetForkinatorTipsEvent';

/** Forky prompt / cooldown keys cleared by "Reset Forky tips". */
export const FORKINATOR_TIPS_RESET_STORAGE_KEYS: readonly string[] = [
  FORKINATOR_GREETING_SHOWN_STORAGE_KEY,
  FORKINATOR_SCANNER_NUDGE_LAST_SHOWN_STORAGE_KEY,
  FORKINATOR_EXPIRATION_PROMPT_LAST_SHOWN_DAY_KEY,
  FORKINATOR_EXPIRATION_PROMPT_LAST_FINGERPRINT_KEY,
  FORKINATOR_AISLE_SORT_PROMPT_LAST_SHOWN_DAY_KEY,
  FORKINATOR_AISLE_SORT_USED_STORAGE_KEY,
  FORKINATOR_FORK_IN_ROAD_LAST_SHOWN_DAY_KEY,
  FORKINATOR_FORK_IN_ROAD_CONSECUTIVE_DISMISSALS_KEY,
  FORKINATOR_FORK_IN_ROAD_COOLDOWN_UNTIL_DAY_KEY,
];

/** Never cleared by tips reset (position, scan completion, non-prompt state). */
export const FORKINATOR_TIPS_PRESERVED_STORAGE_KEYS: readonly string[] = [
  'mealprep.forkinator.position',
  'mealprep.forkinator.hasScanned',
];

const FORKINATOR_STORAGE_PREFIX = 'mealprep.forkinator.';

export function resetForkinatorTipsStorage(): void {
  for (const key of FORKINATOR_TIPS_RESET_STORAGE_KEYS) {
    removeStorageKey(key);
  }
  for (const key of listStorageKeysWithPrefix(FORKINATOR_STORAGE_PREFIX)) {
    if (FORKINATOR_TIPS_PRESERVED_STORAGE_KEYS.includes(key)) continue;
    removeStorageKey(key);
  }
}

/** Clear persisted tip throttles and notify the overlay to reschedule prompts. */
export function resetForkinatorTips(): void {
  resetForkinatorTipsStorage();
  emitForkinatorTipsReset();
}
