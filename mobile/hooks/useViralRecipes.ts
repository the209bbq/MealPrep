import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isViralRecipesConfigured } from '../config/appConfig';
import type { ViralRecipesCategory } from '../config/viralRecipes';
import {
  fetchViralRecipes,
  ViralRecipesNotConfiguredError,
  ViralRecipesUpstreamError,
} from '../lib/viralRecipes/client';
import type { ViralRecipeLinkItem } from '../lib/viralRecipes/types';

export function useViralRecipes(
  session: Session | null,
  category: ViralRecipesCategory,
  options?: { enabled?: boolean },
) {
  const [items, setItems] = useState<ViralRecipeLinkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isViralRecipesConfigured();
  const enabled = configured && (options?.enabled ?? true);

  const load = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchViralRecipes(category, session?.access_token ?? null);
      setItems(result.items);
    } catch (err) {
      setItems([]);
      if (err instanceof ViralRecipesNotConfiguredError) {
        setError(null);
      } else if (err instanceof ViralRecipesUpstreamError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Could not load videos right now.');
      }
    } finally {
      setLoading(false);
    }
  }, [category, enabled, session?.access_token]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, error, enabled: configured, refresh: load };
}
