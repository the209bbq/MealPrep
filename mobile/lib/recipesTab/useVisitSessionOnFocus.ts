import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useHydrated } from '../../hooks/useHydrated';
import {
  forceRecipesTabVisitRotation,
  resolveRecipesTabVisit,
  type RecipesTabVisitSession,
} from './visitState';

/**
 * Re-resolve Recipes tab visit when Home gains focus (rotates creators after visit gap).
 */
export function useRecipesTabVisitSession(
  ownerId: string,
  enabled: boolean,
  options?: { manualRotationEpoch?: number },
): { visitSession: RecipesTabVisitSession | null; visitEpoch: number } {
  const hydrated = useHydrated();
  const [visitEpoch, setVisitEpoch] = useState(0);
  const [visitSession, setVisitSession] = useState<RecipesTabVisitSession | null>(null);

  useEffect(() => {
    if (!enabled || !hydrated) {
      setVisitSession(null);
      return;
    }
    const session = resolveRecipesTabVisit(ownerId, Date.now());
    setVisitSession(session);
    if (session.isNewVisit) {
      setVisitEpoch((value) => value + 1);
    }
  }, [enabled, hydrated, ownerId]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled || !hydrated) return;
      const session = resolveRecipesTabVisit(ownerId, Date.now());
      setVisitSession(session);
      if (session.isNewVisit) {
        setVisitEpoch((value) => value + 1);
      }
    }, [enabled, hydrated, ownerId]),
  );

  const manualRotationEpoch = options?.manualRotationEpoch ?? 0;
  useEffect(() => {
    if (!enabled || !hydrated || manualRotationEpoch === 0) return;
    const session = forceRecipesTabVisitRotation(ownerId, Date.now());
    setVisitSession(session);
    setVisitEpoch((value) => value + 1);
  }, [enabled, hydrated, manualRotationEpoch, ownerId]);

  return { visitSession, visitEpoch };
}
