import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { View } from 'react-native';
import type { TutorialTargetId } from '../config/tutorial';
import {
  getTutorialState,
  registerTutorialTarget,
  subscribeTutorial,
  type TutorialState,
} from '../lib/tutorial/tutorialStore';

/** Whether the first-time tour is open, and on which step. */
export function useTutorialState(): TutorialState {
  return useSyncExternalStore(subscribeTutorial, getTutorialState, getTutorialState);
}

/**
 * Marks an element the tour can light up. Put the returned ref on an existing View or Pressable:
 * nothing about the element changes, the tour only asks where it is while a step points at it.
 */
export function useTutorialTarget(id: TutorialTargetId) {
  const ref = useRef<View>(null);
  useEffect(
    () =>
      registerTutorialTarget(id, (done) => {
        const node = ref.current;
        if (!node || typeof node.measureInWindow !== 'function') {
          done(null);
          return;
        }
        node.measureInWindow((x, y, width, height) => done({ x, y, width, height }));
      }),
    [id],
  );
  return ref;
}
