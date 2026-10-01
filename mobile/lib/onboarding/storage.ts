import { readJson, removeStorageKey, writeJson } from '../storage';

const KEYS = {
  welcomeDismissed: 'mealprep.onboarding.welcomeDismissed',
  tourCompleted: 'mealprep.onboarding.tourCompleted',
  tourQueued: 'mealprep.onboarding.tourQueued',
} as const;

export function readWelcomeDismissed(): boolean {
  return readJson(KEYS.welcomeDismissed, false);
}

export function writeWelcomeDismissed(dismissed: boolean): void {
  writeJson(KEYS.welcomeDismissed, dismissed);
}

export function readTourCompleted(): boolean {
  return readJson(KEYS.tourCompleted, false);
}

export function writeTourCompleted(completed: boolean): void {
  writeJson(KEYS.tourCompleted, completed);
}

export function readTourQueued(): boolean {
  return readJson(KEYS.tourQueued, false);
}

export function writeTourQueued(queued: boolean): void {
  writeJson(KEYS.tourQueued, queued);
}

/** Clears tour progress so the coach can run again (welcome stays dismissed). */
export function resetTourForReplay(): void {
  writeTourCompleted(false);
  writeTourQueued(true);
}

export function clearOnboardingStorage(): void {
  removeStorageKey(KEYS.welcomeDismissed);
  removeStorageKey(KEYS.tourCompleted);
  removeStorageKey(KEYS.tourQueued);
}
