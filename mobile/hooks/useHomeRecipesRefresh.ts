import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { RECIPES_COPY } from '../config/recipesCopy';
import {
  HOME_RECIPES_REFRESH_DEBOUNCE_MS,
  invalidateHomeRecipesCaches,
  shouldDebounceHomeRecipesRefresh,
  type HomeRecipesRefreshState,
} from '../lib/home/homeRecipesRefresh';
import { isOffline } from '../lib/network/isOffline';
import { runHomeRecipePrefetch } from '../lib/mealdb/homePrefetch';
import type { PantryItem } from '../types/mealprep';

const UPDATED_MESSAGE_MS = 2_500;

export function useHomeRecipesRefresh(options: {
  enabled: boolean;
  pantry: PantryItem[];
  session: Session | null;
  creatorChannelIds?: readonly string[];
  onRotationBump: () => void;
  onClassicCatalogRefresh: () => void;
  onCreatorsRefresh: () => void;
  onCategoryReselect?: () => void;
}): {
  refreshing: boolean;
  statusMessage: string | null;
  onRefresh: () => void;
} {
  const {
    enabled,
    pantry,
    session,
    creatorChannelIds,
    onRotationBump,
    onClassicCatalogRefresh,
    onCreatorsRefresh,
    onCategoryReselect,
  } = options;

  const [refreshing, setRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const debounceRef = useRef<HomeRecipesRefreshState>({ lastAttemptAtMs: 0 });
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  const onRefresh = useCallback(() => {
    if (!enabled) return;
    const now = Date.now();
    if (shouldDebounceHomeRecipesRefresh(debounceRef.current, now)) {
      return;
    }
    debounceRef.current = { lastAttemptAtMs: now };

    if (isOffline()) {
      setStatusMessage(RECIPES_COPY.homeToolbarCard.refreshOffline);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      statusTimerRef.current = setTimeout(() => setStatusMessage(null), UPDATED_MESSAGE_MS);
      return;
    }

    setRefreshing(true);
    setStatusMessage(null);

    invalidateHomeRecipesCaches();
    onRotationBump();
    onClassicCatalogRefresh();
    onCreatorsRefresh();
    onCategoryReselect?.();

    void (async () => {
      try {
        await runHomeRecipePrefetch({
          pantry,
          accessToken: session?.access_token ?? null,
          creatorChannelIds,
        });
        setStatusMessage(RECIPES_COPY.homeToolbarCard.refreshUpdated);
      } finally {
        setRefreshing(false);
        if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
        statusTimerRef.current = setTimeout(() => setStatusMessage(null), UPDATED_MESSAGE_MS);
      }
    })();
  }, [
    creatorChannelIds,
    enabled,
    onCategoryReselect,
    onClassicCatalogRefresh,
    onCreatorsRefresh,
    onRotationBump,
    pantry,
    session?.access_token,
  ]);

  return { refreshing, statusMessage, onRefresh };
}

export { HOME_RECIPES_REFRESH_DEBOUNCE_MS };
