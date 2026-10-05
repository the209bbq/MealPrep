import type { RecipeEngagementEvent } from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function scoreNovelty(
  refKey: string,
  events: readonly RecipeEngagementEvent[],
  nowMs: number = Date.now(),
): number {
  let impressions = 0;
  let lastSeenMs = 0;
  for (const event of events) {
    if (event.refKey !== refKey) continue;
    if (event.type !== 'impression' && event.type !== 'open') continue;
    impressions += event.type === 'impression' ? 1 : 0;
    const atMs = Date.parse(event.at);
    if (Number.isFinite(atMs)) {
      lastSeenMs = Math.max(lastSeenMs, atMs);
    }
  }
  if (impressions === 0 && lastSeenMs === 0) {
    return 100;
  }
  const impressionPenalty = Math.min(70, impressions * 12);
  const daysSinceSeen =
    lastSeenMs > 0 ? Math.max(0, (nowMs - lastSeenMs) / MS_PER_DAY) : 30;
  const recencyBoost = Math.min(40, daysSinceSeen * 3);
  return Math.max(0, Math.min(100, 100 - impressionPenalty + recencyBoost * 0.25));
}
