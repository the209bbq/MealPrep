import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { DEFAULT_MIN_PANTRY_MATCH_PERCENT } from '../config/recipeMatching';
import { RECIPES_COPY } from '../config/recipesCopy';
import { getRecipeDiscoveryAccessToken } from '../lib/recipeDiscovery/accessToken';
import {
  fetchPantryDiscoverySuggestions,
  type PantryDiscoverySuggestion,
} from '../lib/recipeDiscovery/pantrySuggestions';
import type { PantryItem } from '../types/mealprep';

export function usePantryDiscoverySuggestions(
  pantry: PantryItem[],
  session: Session | null,
  options?: { enabled?: boolean },
): {
  suggestions: PantryDiscoverySuggestion[];
  loading: boolean;
  error: string | null;
} {
  const enabled = options?.enabled ?? true;
  const minPercent = DEFAULT_MIN_PANTRY_MATCH_PERCENT;
  const accessToken = getRecipeDiscoveryAccessToken(session);
  const pantryEmpty = pantry.length === 0;

  const [suggestions, setSuggestions] = useState<PantryDiscoverySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || pantryEmpty) {
      setSuggestions([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchPantryDiscoverySuggestions(pantry, accessToken, { minPercent })
      .then((result) => {
        if (!cancelled) {
          setSuggestions(result.suggestions);
          setError(result.errorMessage);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestions([]);
          setError(RECIPES_COPY.discoveryErrors.loadFailed);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, enabled, minPercent, pantry, pantryEmpty]);

  return { suggestions, loading, error };
}
