import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
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

  const [welcomeDismissed, setWelcomeDismissed] = useState(() => readWelcomeDismissed());
  const [tourCompleted, setTourCompleted] = useState(() => readTourCompleted());
  const [tourQueued, setTourQueued] = useState(() => readTourQueued());
  const hadSessionRef = useRef(signedIn);

  const showWelcome = authReady && !signedIn && !welcomeDismissed;

  const showTour = authReady && tourQueued && !tourCompleted && !showWelcome;

  useEffect(() => {
    const wasSignedIn = hadSessionRef.current;
    hadSessionRef.current = signedIn;
    if (!signedIn || wasSignedIn) return;
    if (tourCompleted) return;
    setTourQueued(true);
    writeTourQueued(true);
  }, [signedIn, tourCompleted]);

  const dismissWelcomeForBrowse = useCallback(() => {
    setWelcomeDismissed(true);
    writeWelcomeDismissed(true);
    if (!tourCompleted) {
      setTourQueued(true);
      writeTourQueued(true);
    }
  }, [tourCompleted]);

  const dismissWelcomeForSignUp = useCallback(() => {
    setWelcomeDismissed(true);
    writeWelcomeDismissed(true);
    router.push('/admin');
  }, []);

  const completeTour = useCallback(() => {
    setTourCompleted(true);
    setTourQueued(false);
    writeTourCompleted(true);
    writeTourQueued(false);
    router.push('/pantry');
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
