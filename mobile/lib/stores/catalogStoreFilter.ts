import { matchesGroceryNameExcludePattern, resolveGroceryChainFromHaystack } from './groceryFilter';

/**
 * Name filter for Supabase catalog rows (no OSM shop tags).
 * Known grocery chains always pass even when a substring rule is overly broad.
 */
export function isNearbyListStoreNameAllowed(name: string, chain?: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const haystack = `${trimmed} ${chain ?? ''}`.trim().toLowerCase();
  if (resolveGroceryChainFromHaystack(haystack)) return true;
  return !matchesGroceryNameExcludePattern(haystack);
}
