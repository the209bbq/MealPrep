import { useCallback, useEffect, useState } from 'react';
import {
  clearRecipesTabFilters,
  parseStoredRecipesTabFilters,
  RECIPES_TAB_FILTERS_STORAGE_KEY,
  type RecipesTabFilterId,
  toggleRecipesTabFilter,
} from '../config/recipesTabFilters';
import { readJson, writeJson } from '../lib/storage';

export function useRecipesTabFilters() {
  const [activeFilterIds, setActiveFilterIds] = useState<RecipesTabFilterId[]>(() =>
    parseStoredRecipesTabFilters(readJson<unknown>(RECIPES_TAB_FILTERS_STORAGE_KEY, [])),
  );

  useEffect(() => {
    writeJson(RECIPES_TAB_FILTERS_STORAGE_KEY, activeFilterIds);
  }, [activeFilterIds]);

  const toggleFilter = useCallback((filterId: RecipesTabFilterId) => {
    setActiveFilterIds((prev) => toggleRecipesTabFilter(prev, filterId));
  }, []);

  const clearAllFilters = useCallback(() => {
    setActiveFilterIds(clearRecipesTabFilters());
  }, []);

  return { activeFilterIds, toggleFilter, clearAllFilters };
}
