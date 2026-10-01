import { readJson, removeStorageKey, writeJson } from '../storage';
import {
  defaultTutorialProgress,
  normalizeTutorialProgress,
  resumeActiveIndex,
  type HandsOnTutorialProgress,
} from './tutorialProgress';

const KEYS = {
  welcomeDismissed: 'mealprep.onboarding.welcomeDismissed',
  tourCompleted: 'mealprep.onboarding.tourCompleted',
  tourQueued: 'mealprep.onboarding.tourQueued',
} as const;

function tutorialProgressKey(userScope: string): string {
  return `mealprep.onboarding.tutorialProgress.${userScope}`;
}

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

export function readTutorialProgress(userScope: string): HandsOnTutorialProgress {
  const raw = readJson<Partial<HandsOnTutorialProgress> | null>(tutorialProgressKey(userScope), null);
  const normalized = normalizeTutorialProgress(raw);
  return { ...normalized, activeIndex: resumeActiveIndex(normalized) };
}

export function writeTutorialProgress(userScope: string, progress: HandsOnTutorialProgress): void {
  writeJson(tutorialProgressKey(userScope), progress);
}

export function clearTutorialProgress(userScope: string): void {
  removeStorageKey(tutorialProgressKey(userScope));
}

/** Clears tour progress so the coach can run again (welcome stays dismissed). */
export function resetTourForReplay(userScope: string): void {
  writeTourCompleted(false);
  writeTourQueued(true);
  writeTutorialProgress(userScope, defaultTutorialProgress());
}

export function clearOnboardingStorage(): void {
  removeStorageKey(KEYS.welcomeDismissed);
  removeStorageKey(KEYS.tourCompleted);
  removeStorageKey(KEYS.tourQueued);
}
