import { useCallback, useEffect, useState } from 'react';
import { useHydrated } from './useHydrated';
import { MEALDB_COPY } from '../config/mealdb';
import type { RecipesTabRow } from '../config/recipesTabFilters';
import { readMealDbCatalogSnapshot } from '../lib/mealdb/catalogCache';
import { fetchMealDbCatalogRows } from '../lib/mealdb/catalogFeed';
import type { PantryItem } from '../types/mealprep';

export function useMealDbRecipes(
  pantry: PantryItem[],
  options?: { enabled?: boolean; refreshSeed?: number },
): {
  rows: RecipesTabRow[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  refreshSeed: number;
  refreshMealDb: () => void;
} {
  const enabled = options?.enabled ?? true;
  const hydrated = useHydrated();
  const [refreshSeed, setRefreshSeed] = useState(options?.refreshSeed ?? 0);
  const [rows, setRows] = useState<RecipesTabRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshMealDb = useCallback(() => {
    setRefreshSeed((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !hydrated) {
      setRows([]);
      setError(null);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    let cancelled = false;
    const snapshot = readMealDbCatalogSnapshot(pantry);
    if (snapshot.length > 0) {
      setRows(snapshot);
      setLoading(false);
      setLoadingMore(true);
    } else {
      setRows([]);
      setLoading(true);
      setLoadingMore(false);
    }
    setError(null);

    void fetchMealDbCatalogRows(pantry, {
      onRows: (partial) => {
        if (cancelled || partial.length === 0) return;
        setRows(partial);
        setLoading(false);
        setLoadingMore(true);
      },
    })
      .then((result) => {
        if (cancelled) return;
        setRows(result.rows);
        if (result.rows.length > 0) {
          setError(null);
        } else if (result.errorMessage) {
          setError(result.errorMessage);
        } else {
          setError(MEALDB_COPY.empty);
        }
      })
      .catch(() => {
        if (!cancelled) {
          if (snapshot.length === 0) {
            setRows([]);
          }
          setError(MEALDB_COPY.error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, hydrated, pantry, refreshSeed]);

  return { rows, loading, loadingMore, error, refreshSeed, refreshMealDb };
}
