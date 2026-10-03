import { useCallback, useEffect, useState } from 'react';
import { RECIPE_SOURCES } from '../config/recipeSources';
import { fetchPublishedLibraryRecipes } from '../lib/libraryRecipes/client';
import type { Recipe } from '../types/mealprep';

export function usePublishedLibraryRecipes(): {
  libraryRecipes: Recipe[];
  loading: boolean;
  refreshLibrary: () => void;
} {
  const enabled = RECIPE_SOURCES.libraryRecipesEnabled;
  const [libraryRecipes, setLibraryRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [refreshSeed, setRefreshSeed] = useState(0);

  const refreshLibrary = useCallback(() => {
    setRefreshSeed((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLibraryRecipes([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchPublishedLibraryRecipes({ forceRefresh: refreshSeed > 0 })
      .then((rows) => {
        if (!cancelled) setLibraryRecipes(rows);
      })
      .catch(() => {
        if (!cancelled) setLibraryRecipes([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, refreshSeed]);

  return { libraryRecipes, loading, refreshLibrary };
}
