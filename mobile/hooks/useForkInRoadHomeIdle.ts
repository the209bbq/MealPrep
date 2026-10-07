import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import {
  resetForkInRoadHomeIdleTimer,
  setForkInRoadHomeFocused,
} from '../lib/forkinator/forkInRoadIdle';

/** Home screen: track focus and reset the fork-in-the-road idle timer on scroll or recipe open. */
export function useForkInRoadHomeIdle(options: {
  recipeDetailOpen: boolean;
}): { onHomeScroll: () => void } {
  useFocusEffect(
    useCallback(() => {
      setForkInRoadHomeFocused(true);
      return () => setForkInRoadHomeFocused(false);
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (options.recipeDetailOpen) {
        resetForkInRoadHomeIdleTimer();
      }
    }, [options.recipeDetailOpen]),
  );

  const onHomeScroll = useCallback(() => {
    resetForkInRoadHomeIdleTimer();
  }, []);

  return { onHomeScroll };
}
