import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ONBOARDING_COPY } from '../config/onboarding';
import {
  readTourCompleted,
  readTourQueued,
  readTutorialProgress,
  readWelcomeDismissed,
  resetTourForReplay,
  writeTourCompleted,
  writeTourQueued,
  writeTutorialProgress,
  writeWelcomeDismissed,
} from '../lib/onboarding/storage';
import {
  currentStepId,
  defaultTutorialProgress,
  isTutorialRecapScreen,
  markStepDone,
  markStepSkipped,
  type HandsOnTutorialProgress,
  type HandsOnTutorialStepId,
} from '../lib/onboarding/tutorialProgress';

export type TutorialPantryLaunch = 'scan' | 'manual';

export type TutorialTaskLaunch =
  | { kind: 'route'; href: Href; pantryAction?: TutorialPantryLaunch }
  | { kind: 'pantry'; action: TutorialPantryLaunch };

function tutorialUserScope(session: Session | null): string {
  return session?.user?.id ?? 'guest';
}

function hrefWithPantryAction(href: Href, action?: TutorialPantryLaunch): Href {
  if (!action) return href;
  const base = typeof href === 'string' ? href : href.pathname ?? '/pantry';
  const query = action === 'scan' ? 'tutorialScan=1' : 'tutorialManual=1';
  return `${base}?${query}` as Href;
}

export function useOnboarding(input: {
  session: Session | null;
  authReady: boolean;
}) {
  const { session, authReady } = input;
  const signedIn = session != null;
  const userScope = tutorialUserScope(session);

  const [welcomeDismissed, setWelcomeDismissed] = useState(() => readWelcomeDismissed());
  const [tourCompleted, setTourCompleted] = useState(() => readTourCompleted());
  const [tourQueued, setTourQueued] = useState(() => readTourQueued());
  const [progress, setProgress] = useState<HandsOnTutorialProgress>(() => readTutorialProgress(userScope));
  const hadSessionRef = useRef(signedIn);
  const scopeRef = useRef(userScope);

  useEffect(() => {
    if (scopeRef.current === userScope) return;
    scopeRef.current = userScope;
    setProgress(readTutorialProgress(userScope));
  }, [userScope]);

  const persistProgress = useCallback(
    (next: HandsOnTutorialProgress) => {
      setProgress(next);
      writeTutorialProgress(userScope, next);
    },
    [userScope],
  );

  const showWelcome = authReady && !signedIn && !welcomeDismissed;
  const showTour = authReady && tourQueued && !tourCompleted && !showWelcome;
  const showTutorialModal = showTour && !progress.taskInProgress;
  const showTutorialPill = showTour && progress.taskInProgress;

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

  const finishTutorial = useCallback(() => {
    setTourCompleted(true);
    setTourQueued(false);
    writeTourCompleted(true);
    writeTourQueued(false);
    persistProgress({ ...progress, taskInProgress: false });
    router.push('/pantry');
  }, [persistProgress, progress]);

  const skipTour = useCallback(() => {
    setTourCompleted(true);
    setTourQueued(false);
    writeTourCompleted(true);
    writeTourQueued(false);
    persistProgress({ ...progress, taskInProgress: false });
  }, [persistProgress, progress]);

  const skipTutorialStep = useCallback(() => {
    const stepId = currentStepId(progress);
    if (!stepId) {
      finishTutorial();
      return;
    }
    persistProgress(markStepSkipped(progress, stepId));
  }, [finishTutorial, persistProgress, progress]);

  const beginTutorialTask = useCallback(
    (launch: TutorialTaskLaunch) => {
      const stepId = currentStepId(progress);
      if (!stepId) return;
      const stepCopy = ONBOARDING_COPY.tutorial.steps.find((s) => s.id === stepId);
      persistProgress({ ...progress, taskInProgress: true });
      if (launch.kind === 'pantry') {
        router.push(hrefWithPantryAction('/pantry', launch.action));
        return;
      }
      const pantryAction =
        launch.pantryAction ?? (stepCopy?.primaryPantryAction as TutorialPantryLaunch | undefined);
      router.push(hrefWithPantryAction(launch.href, pantryAction));
    },
    [persistProgress, progress],
  );

  const returnToTutorial = useCallback(() => {
    persistProgress({ ...progress, taskInProgress: false });
  }, [persistProgress, progress]);

  const requestTourReplay = useCallback(() => {
    resetTourForReplay(userScope);
    setTourCompleted(false);
    setTourQueued(true);
    setProgress(defaultTutorialProgress());
  }, [userScope]);

  const notifyTutorialStepComplete = useCallback(
    (stepId: HandsOnTutorialStepId) => {
      if (!showTour) return;
      const active = currentStepId(progress);
      if (active !== stepId) return;
      if (progress.steps[stepId] !== 'pending') return;
      persistProgress(markStepDone(progress, stepId));
    },
    [persistProgress, progress, showTour],
  );

  const tutorialRecapVisible = showTutorialModal && isTutorialRecapScreen(progress);

  return useMemo(
    () => ({
      showWelcome,
      showTour,
      showTutorialModal,
      showTutorialPill,
      tutorialProgress: progress,
      tutorialRecapVisible,
      dismissWelcomeForBrowse,
      dismissWelcomeForSignUp,
      finishTutorial,
      skipTour,
      skipTutorialStep,
      beginTutorialTask,
      returnToTutorial,
      requestTourReplay,
      notifyTutorialStepComplete,
      /** @deprecated use finishTutorial */
      completeTour: finishTutorial,
    }),
    [
      beginTutorialTask,
      dismissWelcomeForBrowse,
      dismissWelcomeForSignUp,
      finishTutorial,
      notifyTutorialStepComplete,
      progress,
      requestTourReplay,
      returnToTutorial,
      showTour,
      showTutorialModal,
      showTutorialPill,
      showWelcome,
      skipTour,
      skipTutorialStep,
      tutorialRecapVisible,
    ],
  );
}
