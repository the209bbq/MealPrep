import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
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
  options?: { enabled?: boolean; refreshSeed?: number },
): {
  suggestions: PantryDiscoverySuggestion[];
  loading: boolean;
  error: string | null;
  refreshSeed: number;
  refreshDiscovery: () => void;
} {
  const enabled = options?.enabled ?? true;
  const minPercent = DEFAULT_MIN_PANTRY_MATCH_PERCENT;
  const accessToken = getRecipeDiscoveryAccessToken(session);
  const [refreshSeed, setRefreshSeed] = useState(options?.refreshSeed ?? 0);

  const [suggestions, setSuggestions] = useState<PantryDiscoverySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshDiscovery = useCallback(() => {
    setRefreshSeed((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setSuggestions([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchPantryDiscoverySuggestions(pantry, accessToken, {
      minPercent,
      refreshSeed,
      onPartial: (partial) => {
        if (!cancelled) setSuggestions(partial);
      },
    })
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
  }, [accessToken, enabled, minPercent, pantry, refreshSeed]);

  return { suggestions, loading, error, refreshSeed, refreshDiscovery };
}
