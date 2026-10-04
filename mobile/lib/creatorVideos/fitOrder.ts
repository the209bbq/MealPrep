/** Mirrors supabase/functions/creator-videos/fitOrder.ts for client-side sorting. */

export function creatorFitSortRank(fit: string | null | undefined): number {
  const normalized = (fit ?? '').toLowerCase();
  if (normalized.includes('high')) return 1;
  if (normalized.includes('medium')) return 2;
  return 3;
}

export function compareCreatorsByFitAndSubscribers(
  a: { fit?: string | null; subscriberCount: number },
  b: { fit?: string | null; subscriberCount: number },
): number {
  const fitDiff = creatorFitSortRank(a.fit) - creatorFitSortRank(b.fit);
  if (fitDiff !== 0) return fitDiff;
  return b.subscriberCount - a.subscriberCount;
}
