import { FREE_PHOTO_SCANS } from '../../config/plans';

/**
 * Free shelf scans left for a free account, from the count the server keeps.
 * `used` is null while unknown (not loaded, or the count could not be read): then no free scans
 * are offered, and the server stays the judge either way.
 */
export function freeScansRemaining(used: number | null, limit: number = FREE_PHOTO_SCANS): number {
  if (used == null || !Number.isFinite(used)) return 0;
  return Math.max(0, Math.floor(limit) - Math.max(0, Math.floor(used)));
}

/** After a scan the server reports what is left; trust that over the local count. */
export function freeScansUsedFromServer(
  usage: { isPlus: boolean; limit: number | null; remaining: number | null } | undefined,
  limit: number = FREE_PHOTO_SCANS,
): number | null {
  if (!usage || usage.isPlus || usage.remaining == null) return null;
  return Math.max(0, limit - usage.remaining);
}
