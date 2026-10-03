import { useCallback, useEffect, useState } from 'react';
import {
  clearRecipesTabFilters,
  DEFAULT_RECIPES_TAB_FILTER_STATE,
  parseStoredRecipesTabFilterState,
  RECIPES_TAB_FILTERS_STORAGE_KEY,
  type RecipesTabFilterDimension,
  type RecipesTabFilterState,
} from '../config/recipesTabFilters';
import { readJson, writeJson } from '../lib/storage';
import { useHydrated } from './useHydrated';

export function useRecipesTabFilters() {
  const hydrated = useHydrated();
  const [filters, setFilters] = useState<RecipesTabFilterState>(DEFAULT_RECIPES_TAB_FILTER_STATE);

  useEffect(() => {
    if (!hydrated) return;
    setFilters(parseStoredRecipesTabFilterState(readJson<unknown>(RECIPES_TAB_FILTERS_STORAGE_KEY, null)));
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeJson(RECIPES_TAB_FILTERS_STORAGE_KEY, filters);
  }, [filters, hydrated]);

  const setFilter = useCallback(
    <K extends RecipesTabFilterDimension>(dimension: K, value: RecipesTabFilterState[K]) => {
      setFilters((prev) => ({ ...prev, [dimension]: value }));
    },
    [],
  );

  const clearAllFilters = useCallback(() => {
    setFilters(clearRecipesTabFilters());
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_RECIPES_TAB_FILTER_STATE });
  }, []);

  return { filters, setFilter, clearAllFilters, resetFilters };
}
