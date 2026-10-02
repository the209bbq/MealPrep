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

export function useRecipesTabFilters() {
  const [filters, setFilters] = useState<RecipesTabFilterState>(() =>
    parseStoredRecipesTabFilterState(readJson<unknown>(RECIPES_TAB_FILTERS_STORAGE_KEY, null)),
  );

  useEffect(() => {
    writeJson(RECIPES_TAB_FILTERS_STORAGE_KEY, filters);
  }, [filters]);

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
