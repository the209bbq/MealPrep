import type { CreatorListItem } from '../creatorVideos/types';

export function log10Pop(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.log10(value);
}

export function minMaxNormalize(values: readonly number[]): (value: number) => number {
  if (values.length === 0) return () => 0;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max <= min) return () => 0.5;
  return (value: number) => (value - min) / (max - min);
}

export function popularityPriorForCreator(
  creator: CreatorListItem,
  normalizeSubs: (n: number) => number,
  normalizeViews: (n: number) => number,
): number {
  const popSubs = normalizeSubs(creator.subscriberCount);
  const views = creator.totalChannelViews ?? 0;
  if (views > 0) {
    return 0.7 * popSubs + 0.3 * normalizeViews(views);
  }
  return popSubs;
}

export function buildPopularityNormalizers(creators: readonly CreatorListItem[]): {
  normalizeSubs: (n: number) => number;
  normalizeViews: (n: number) => number;
} {
  const subs = creators.map((c) => log10Pop(c.subscriberCount));
  const views = creators.map((c) => log10Pop(c.totalChannelViews ?? 0));
  const normalizeSubs = minMaxNormalize(subs);
  const normalizeViews = minMaxNormalize(views);
  return {
    normalizeSubs: (n) => normalizeSubs(log10Pop(n)),
    normalizeViews: (n) => normalizeViews(log10Pop(n)),
  };
}
