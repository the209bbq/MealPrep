import { readJson, writeJson } from '../storage';
import {
  forkinatorPromptDayKey,
  markForkinatorPromptShownToday,
  readForkinatorPromptLastShownDay,
  shouldShowForkinatorPromptToday,
} from './forkinatorOncePerDay';

export const FORKINATOR_FORK_IN_ROAD_LAST_SHOWN_DAY_KEY =
  'mealprep.forkinator.forkInRoadLastShownDay';
export const FORKINATOR_FORK_IN_ROAD_CONSECUTIVE_DISMISSALS_KEY =
  'mealprep.forkinator.forkInRoadConsecutiveDismissals';
export const FORKINATOR_FORK_IN_ROAD_COOLDOWN_UNTIL_DAY_KEY =
  'mealprep.forkinator.forkInRoadCooldownUntilDay';

const MAX_DISMISSALS_BEFORE_LONG_COOLDOWN = 2;
const LONG_COOLDOWN_DAYS = 3;

export function readForkInRoadConsecutiveDismissals(): number {
  const raw = readJson<number | null>(FORKINATOR_FORK_IN_ROAD_CONSECUTIVE_DISMISSALS_KEY, null);
  if (raw == null || typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return 0;
  return Math.floor(raw);
}

export function readForkInRoadCooldownUntilDay(): string | null {
  const raw = readJson<string | null>(FORKINATOR_FORK_IN_ROAD_COOLDOWN_UNTIL_DAY_KEY, null);
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

function addDaysToDayKey(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return forkinatorPromptDayKey(date);
}

export function markForkInRoadPromptShown(now = new Date()): void {
  markForkinatorPromptShownToday(FORKINATOR_FORK_IN_ROAD_LAST_SHOWN_DAY_KEY, now);
}

export function markForkInRoadPromptEngaged(now = new Date()): void {
  markForkInRoadPromptShown(now);
  writeJson(FORKINATOR_FORK_IN_ROAD_CONSECUTIVE_DISMISSALS_KEY, 0);
  writeJson(FORKINATOR_FORK_IN_ROAD_COOLDOWN_UNTIL_DAY_KEY, null);
}

export function markForkInRoadPromptDismissed(now = new Date()): void {
  markForkInRoadPromptShown(now);
  const streak = readForkInRoadConsecutiveDismissals() + 1;
  writeJson(FORKINATOR_FORK_IN_ROAD_CONSECUTIVE_DISMISSALS_KEY, streak);
  if (streak >= MAX_DISMISSALS_BEFORE_LONG_COOLDOWN) {
    const today = forkinatorPromptDayKey(now);
    writeJson(
      FORKINATOR_FORK_IN_ROAD_COOLDOWN_UNTIL_DAY_KEY,
      addDaysToDayKey(today, LONG_COOLDOWN_DAYS),
    );
    writeJson(FORKINATOR_FORK_IN_ROAD_CONSECUTIVE_DISMISSALS_KEY, 0);
  }
}

export function shouldAutoShowForkInRoadPrompt(now = new Date()): boolean {
  const today = forkinatorPromptDayKey(now);
  const cooldownUntil = readForkInRoadCooldownUntilDay();
  if (cooldownUntil && today < cooldownUntil) return false;

  const lastShown = readForkinatorPromptLastShownDay(FORKINATOR_FORK_IN_ROAD_LAST_SHOWN_DAY_KEY);
  if (lastShown === today) return false;

  return shouldShowForkinatorPromptToday(FORKINATOR_FORK_IN_ROAD_LAST_SHOWN_DAY_KEY, now);
}
