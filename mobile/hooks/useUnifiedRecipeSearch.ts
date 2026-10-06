import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isCreatorRecipesConfigured } from '../config/appConfig';
import { searchCreatorVideos } from '../lib/creatorVideos/client';
import { fetchMealDbSearchRows } from '../lib/mealdb/searchFeed';
import { buildCreatorFeedCardModels } from '../lib/recipes/creatorFeedRows';
import { searchImportedKitchenRecipes } from '../lib/recipes/kitchenSearch';
import { mergeRecipeSearchResults, type RecipesSearchResultItem } from '../lib/recipes/mergeSearchResults';
import type { PantryMatchIndex } from '../lib/recipeMatch';
import type { PantryItem, Recipe } from '../types/mealprep';

export function useUnifiedRecipeSearch(options: {
  query: string;
  pantry: PantryItem[];
  session: Session | null;
  kitchenRecipes: Recipe[];
  pantryMatches: PantryMatchIndex;
  debounceMs?: number;
}) {
  const { query, pantry, session, kitchenRecipes, pantryMatches, debounceMs = 350 } = options;
  const [results, setResults] = useState<RecipesSearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [debouncing, setDebouncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      setDebouncing(false);
      return;
    }

    let cancelled = false;
    setDebouncing(true);
    const timer = setTimeout(() => {
      setDebouncing(false);
      setLoading(true);
      setError(null);
      void (async () => {
        try {
          const classicPromise = fetchMealDbSearchRows(trimmed, pantry);
          const creatorPromise = isCreatorRecipesConfigured()
            ? searchCreatorVideos(trimmed, session?.access_token ?? null)
            : Promise.resolve([]);
          const [classicRows, creatorVideos] = await Promise.all([classicPromise, creatorPromise]);
          if (cancelled) return;
          const importedKitchenRows = searchImportedKitchenRecipes(trimmed, kitchenRecipes, pantryMatches);
          const videoModels = buildCreatorFeedCardModels(
            creatorVideos,
            kitchenRecipes,
            pantryMatches,
          );
          setResults(mergeRecipeSearchResults(classicRows, videoModels, importedKitchenRows));
        } catch {
          if (!cancelled) {
            setResults([]);
            setError('Search is unavailable right now.');
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setDebouncing(false);
    };
  }, [debounceMs, kitchenRecipes, pantry, pantryMatches, query, session?.access_token]);

  return { results, loading, debouncing, error };
}
