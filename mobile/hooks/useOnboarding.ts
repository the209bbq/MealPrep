import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { APP_ROUTES } from '../config/appRoutes';
import { useHydrated } from './useHydrated';
import {
  readTourCompleted,
  readTourQueued,
  readWelcomeDismissed,
  resetTourForReplay,
  writeTourCompleted,
  writeTourQueued,
  writeWelcomeDismissed,
} from '../lib/onboarding/storage';

export function useOnboarding(input: {
  session: Session | null;
  authReady: boolean;
}) {
  const { session, authReady } = input;
  const signedIn = session != null;
  const hydrated = useHydrated();

  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [tourCompleted, setTourCompleted] = useState(false);
  const [tourQueued, setTourQueued] = useState(false);
  const hadSessionRef = useRef(signedIn);

  useEffect(() => {
    if (!hydrated) return;
    setWelcomeDismissed(readWelcomeDismissed());
    setTourCompleted(readTourCompleted());
    setTourQueued(readTourQueued());
  }, [hydrated]);

  const showWelcome = hydrated && authReady && !signedIn && !welcomeDismissed;

  const showTour = hydrated && authReady && tourQueued && !tourCompleted && !showWelcome;

  useEffect(() => {
    const wasSignedIn = hadSessionRef.current;
    hadSessionRef.current = signedIn;
    if (!signedIn || wasSignedIn) return;
    if (tourCompleted) return;
    setTourQueued(true);
    writeTourQueued(true);
  }, [signedIn, tourCompleted]);

  const queueTutorial = useCallback(() => {
    if (!tourCompleted) {
      setTourQueued(true);
      writeTourQueued(true);
    }
  }, [tourCompleted]);

  const dismissWelcomeForBrowse = useCallback(() => {
    setWelcomeDismissed(true);
    writeWelcomeDismissed(true);
    queueTutorial();
  }, [queueTutorial]);

  const dismissWelcomeForSignUp = useCallback(() => {
    setWelcomeDismissed(true);
    writeWelcomeDismissed(true);
    queueTutorial();
  }, [queueTutorial]);

  const completeTour = useCallback(() => {
    setTourCompleted(true);
    setTourQueued(false);
    writeTourCompleted(true);
    writeTourQueued(false);
    router.push(APP_ROUTES.pantry);
  }, []);

  const skipTour = useCallback(() => {
    setTourCompleted(true);
    setTourQueued(false);
    writeTourCompleted(true);
    writeTourQueued(false);
  }, []);

  const requestTourReplay = useCallback(() => {
    resetTourForReplay();
    setTourCompleted(false);
    setTourQueued(true);
  }, []);

  return useMemo(
    () => ({
      showWelcome,
      showTour,
      dismissWelcomeForBrowse,
      dismissWelcomeForSignUp,
      completeTour,
      skipTour,
      requestTourReplay,
    }),
    [
      completeTour,
      dismissWelcomeForBrowse,
      dismissWelcomeForSignUp,
      requestTourReplay,
      showTour,
      showWelcome,
      skipTour,
    ],
  );
}
