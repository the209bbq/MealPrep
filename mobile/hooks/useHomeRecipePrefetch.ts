import { useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import type { PantryItem } from '../types/mealprep';
import { useHydrated } from './useHydrated';
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
  const hydrated = useHydrated();
  const pantryRef = useRef(pantry);
  const sessionRef = useRef(session);
  const creatorChannelIdsRef = useRef(creatorChannelIds);
  pantryRef.current = pantry;
  sessionRef.current = session;
  creatorChannelIdsRef.current = creatorChannelIds;

  useEffect(() => {
    if (!enabled || !hydrated) return;

    const task = InteractionManager.runAfterInteractions(() => {
      revalidateStaleMealDbHomeCachesOnOpen();
      revalidateStaleCreatorVideosCachesOnOpen(sessionRef.current?.access_token ?? null);
      scheduleHomeRecipePrefetch({
        pantry: pantryRef.current,
        accessToken: sessionRef.current?.access_token ?? null,
        creatorChannelIds: creatorChannelIdsRef.current,
        listOnly: true,
      });
    });

    return () => {
      task.cancel();
    };
  }, [enabled, hydrated]);
}
