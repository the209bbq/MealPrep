import { useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import type { PantryItem } from '../types/mealprep';
import { revalidateStaleMealDbHomeCachesOnOpen } from '../lib/mealdb/homeCacheControl';
import { scheduleHomeRecipePrefetch } from '../lib/mealdb/homePrefetch';
import { revalidateStaleCreatorVideosCachesOnOpen } from '../lib/creatorVideos/client';

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
      revalidateStaleMealDbHomeCachesOnOpen();
      revalidateStaleCreatorVideosCachesOnOpen(session?.access_token ?? null);
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
