import type { EngagementIndexV2 } from './engagementIndex';

export function scoreNoveltyFromIndex(
  refKey: string,
  index: EngagementIndexV2,
  nowMs: number = Date.now(),
): number {
  const row = index.impressions14d[refKey];
  if (!row) return 100;
  const ageDays = (nowMs - row.lastMs) / (24 * 60 * 60 * 1000);
  const impressions = ageDays > 14 ? 0 : row.count;
  const novelty01 = Math.exp(-impressions / 3);
  return Math.max(0, Math.min(100, novelty01 * 100));
}

/** @deprecated prefer scoreNoveltyFromIndex */
export function scoreNovelty(
  refKey: string,
  events: readonly { refKey: string; type: string; at: string }[],
  nowMs: number = Date.now(),
): number {
  let impressions = 0;
  const windowMs = 14 * 24 * 60 * 60 * 1000;
  for (const event of events) {
    if (event.refKey !== refKey || event.type !== 'impression') continue;
    const atMs = Date.parse(event.at);
    if (Number.isFinite(atMs) && nowMs - atMs <= windowMs) impressions += 1;
  }
  const novelty01 = Math.exp(-impressions / 3);
  return Math.max(0, Math.min(100, novelty01 * 100));
}
