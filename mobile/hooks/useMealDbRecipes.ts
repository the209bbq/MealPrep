import { useCallback, useEffect, useState } from 'react';
import { MEALDB_COPY } from '../config/mealdb';
import type { RecipesTabRow } from '../config/recipesTabFilters';
import { fetchMealDbCatalogRows } from '../lib/mealdb/catalogFeed';
import type { PantryItem } from '../types/mealprep';

export function useMealDbRecipes(
  pantry: PantryItem[],
  options?: { enabled?: boolean; refreshSeed?: number },
): {
  rows: RecipesTabRow[];
  loading: boolean;
  error: string | null;
  refreshSeed: number;
  refreshMealDb: () => void;
} {
  const enabled = options?.enabled ?? true;
  const [refreshSeed, setRefreshSeed] = useState(options?.refreshSeed ?? 0);
  const [rows, setRows] = useState<RecipesTabRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshMealDb = useCallback(() => {
    setRefreshSeed((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchMealDbCatalogRows(pantry)
      .then((result) => {
        if (cancelled) return;
        setRows(result.rows);
        setError(result.errorMessage);
        if (result.rows.length === 0 && !result.errorMessage) {
          setError(MEALDB_COPY.empty);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setError(MEALDB_COPY.error);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, pantry, refreshSeed]);

  return { rows, loading, error, refreshSeed, refreshMealDb };
}
