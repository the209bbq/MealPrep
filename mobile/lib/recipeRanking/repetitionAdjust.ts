import type { EngagementIndexV2 } from './engagementIndex';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function repetitionScoreAdjust(
  refKey: string,
  index: EngagementIndexV2,
  nowMs: number = Date.now(),
): number {
  const lastCook = index.lastCookConfirmedMs[refKey];
  if (lastCook) {
    const days = (nowMs - lastCook) / MS_PER_DAY;
    if (days < 7) return -15;
    if (days < 14) return -7;
  }
  const totalCooks = index.cookConfirmedTotal[refKey] ?? 0;
  if (totalCooks >= 3 && lastCook && (nowMs - lastCook) / MS_PER_DAY >= 14) {
    return 5;
  }
  return 0;
}
