import { useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import type { PantryItem } from '../types/mealprep';
import { scheduleHomeRecipePrefetch } from '../lib/mealdb/homePrefetch';

export function useHomeRecipePrefetch(options: {
  enabled: boolean;
  pantry: PantryItem[];
  session: Session | null;
  creatorChannelIds?: readonly string[];
}): void {
  const { enabled, pantry, session, creatorChannelIds } = options;
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;

    const task = InteractionManager.runAfterInteractions(() => {
      scheduleHomeRecipePrefetch({
        pantry,
        accessToken: session?.access_token ?? null,
        creatorChannelIds,
      });
    });

    return () => {
      task.cancel();
    };
  }, [creatorChannelIds, enabled, pantry, session?.access_token]);
}
