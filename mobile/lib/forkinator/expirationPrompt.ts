import { readJson, writeJson } from '../storage';
import {
  filterPantryExpiringWithinOneDay,
  fingerprintPantryItemIds,
} from '../pantry/expiringWithinOneDay';
import type { PantryItem } from '../../types/mealprep';
import {
  forkinatorPromptDayKey,
  markForkinatorPromptShownToday,
  readForkinatorPromptLastShownDay,
} from './forkinatorOncePerDay';

export const FORKINATOR_EXPIRATION_PROMPT_LAST_SHOWN_DAY_KEY =
  'mealprep.forkinator.expirationPromptLastShownDay';
export const FORKINATOR_EXPIRATION_PROMPT_LAST_FINGERPRINT_KEY =
  'mealprep.forkinator.expirationPromptLastFingerprint';

export function readForkinatorExpirationPromptLastFingerprint(): string | null {
  const raw = readJson<string | null>(FORKINATOR_EXPIRATION_PROMPT_LAST_FINGERPRINT_KEY, null);
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

export function markForkinatorExpirationPromptShown(
  itemIds: readonly string[],
  now = new Date(),
): void {
  markForkinatorPromptShownToday(FORKINATOR_EXPIRATION_PROMPT_LAST_SHOWN_DAY_KEY, now);
  writeJson(FORKINATOR_EXPIRATION_PROMPT_LAST_FINGERPRINT_KEY, fingerprintPantryItemIds(itemIds));
}

export function shouldAutoShowForkinatorExpirationPrompt(
  pantry: readonly PantryItem[],
  now = new Date(),
): { show: boolean; items: PantryItem[] } {
  const items = filterPantryExpiringWithinOneDay(pantry, now);
  if (items.length === 0) return { show: false, items: [] };

  const fingerprint = fingerprintPantryItemIds(items.map((item) => item.id));
  const lastDay = readForkinatorPromptLastShownDay(FORKINATOR_EXPIRATION_PROMPT_LAST_SHOWN_DAY_KEY);
  const today = forkinatorPromptDayKey(now);
  if (lastDay === today) {
    const lastFingerprint = readForkinatorExpirationPromptLastFingerprint();
    if (lastFingerprint === fingerprint) return { show: false, items };
  }

  return { show: true, items };
}
