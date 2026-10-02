import type { PantryDiscoverySuggestion } from './pantrySuggestions';

export function splitDiscoveryCookNowLists(
  suggestions: PantryDiscoverySuggestion[],
): { cookNow: PantryDiscoverySuggestion[]; needItems: PantryDiscoverySuggestion[] } {
  return {
    cookNow: suggestions.filter((row) => row.match.missingCount === 0),
    needItems: suggestions.filter((row) => row.match.missingCount > 0),
  };
}
