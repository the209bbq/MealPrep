import { todayIsoDate } from '../pantry/expiry';
import { readJson, writeJson } from '../storage';

export function forkinatorPromptDayKey(now = new Date()): string {
  return todayIsoDate(now);
}

export function readForkinatorPromptLastShownDay(storageKey: string): string | null {
  const raw = readJson<string | null>(storageKey, null);
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

export function markForkinatorPromptShownToday(storageKey: string, now = new Date()): void {
  writeJson(storageKey, forkinatorPromptDayKey(now));
}

export function shouldShowForkinatorPromptToday(
  storageKey: string,
  now = new Date(),
): boolean {
  const last = readForkinatorPromptLastShownDay(storageKey);
  if (!last) return true;
  return last !== forkinatorPromptDayKey(now);
}
