import { useCallback, useEffect, useRef, useState } from 'react';
import type { RecipesTabRow } from '../config/recipesTabFilters';
import type { MealDbCatalogCategory } from '../config/recipesTabSurface';
import { readMealDbCategorySnapshot, clearMealDbCategoryFeedSnapshot } from '../lib/mealdb/categoryFeedCache';
import { fetchMealDbCategoryFeedRows } from '../lib/mealdb/categories';
import { kitchenCategoryRowsAvailableOffline } from '../lib/mealdb/offlineCategoryRows';
import type { PantryItem } from '../types/mealprep';

export function useClassicCategoryFeed(
  category: MealDbCatalogCategory | null,
  pantry: PantryItem[],
  refreshSeed: number,
): {
  rows: RecipesTabRow[];
  loading: boolean;
  loadFailed: boolean;
  retryLoad: () => void;
  syncRow: (resolved: RecipesTabRow) => void;
  removeRowById: (recipeId: string) => void;
  offlineCategoryEmpty: boolean;
} {
  const [rows, setRows] = useState<RecipesTabRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [offlineCategoryEmpty, setOfflineCategoryEmpty] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const lastFailedCategoryRef = useRef<MealDbCatalogCategory | null>(null);
  const prevCategoryRef = useRef<MealDbCatalogCategory | null>(null);
  const forceBypassListCacheRef = useRef(false);

  const applyOfflineRows = useCallback(() => {
    if (!category) return;
    setRows((prev) => {
      const offline = kitchenCategoryRowsAvailableOffline(prev, pantry);
      setOfflineCategoryEmpty(offline.length === 0);
      setLoading(false);
      setLoadFailed(false);
      return offline;
    });
  }, [category, pantry]);

  const syncRow = useCallback((resolved: RecipesTabRow) => {
    setRows((prev) => {
      const index = prev.findIndex(
        (candidate) => candidate.kind === 'kitchen' && candidate.recipe.id === resolved.recipe.id,
      );
      if (index < 0) return prev;
      const next = [...prev];
      next[index] = resolved;
      return next;
    });
  }, []);

  const removeRowById = useCallback((recipeId: string) => {
    setRows((prev) =>
      prev.filter((candidate) => candidate.kind !== 'kitchen' || candidate.recipe.id !== recipeId),
    );
  }, []);

  const retryLoad = useCallback(() => {
    if (!category) return;
    clearMealDbCategoryFeedSnapshot(category, pantry);
    lastFailedCategoryRef.current = category;
    forceBypassListCacheRef.current = true;
    setLoadFailed(false);
    setRetryTick((value) => value + 1);
  }, [category, pantry]);

  useEffect(() => {
    if (!category) return;
    const onOffline = () => applyOfflineRows();
    if (typeof window !== 'undefined') {
      window.addEventListener('offline', onOffline);
      return () => window.removeEventListener('offline', onOffline);
    }
    return undefined;
  }, [applyOfflineRows, category]);

  useEffect(() => {
    if (!category) {
      prevCategoryRef.current = null;
      setRows([]);
      setLoading(false);
      setLoadFailed(false);
      setOfflineCategoryEmpty(false);
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();
    const reopenedAfterFailure =
      lastFailedCategoryRef.current === category && prevCategoryRef.current !== category;
    prevCategoryRef.current = category;
    const bypassListCache = reopenedAfterFailure || forceBypassListCacheRef.current;
    if (forceBypassListCacheRef.current) {
      forceBypassListCacheRef.current = false;
    }

    const snapshot = readMealDbCategorySnapshot(category, pantry);
    if (snapshot.length > 0) {
      setRows(snapshot);
      setLoading(false);
    } else {
      setRows([]);
      setLoading(true);
    }
    setLoadFailed(false);
    setOfflineCategoryEmpty(false);

    void fetchMealDbCategoryFeedRows(category, pantry, {
      bypassListCache,
      signal: abortController.signal,
      onRows: (partial) => {
        if (cancelled || partial.length === 0) return;
        setRows(partial);
        setLoading(false);
      },
    })
      .then((result) => {
        if (cancelled) return;
        setRows(result.rows);
        setOfflineCategoryEmpty(Boolean(result.offlineCategoryEmpty));
        if (result.listFetchFailed) {
          lastFailedCategoryRef.current = category;
          setLoadFailed(true);
        } else {
          lastFailedCategoryRef.current = null;
          setLoadFailed(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [category, pantry, refreshSeed, retryTick]);

  return { rows, loading, loadFailed, retryLoad, syncRow, removeRowById, offlineCategoryEmpty };
}
