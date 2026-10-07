import { readJson, writeJson } from '../storage';

export const FORKINATOR_GREETING_SHOWN_STORAGE_KEY = 'mealprep.forkinator.greetingShown';

/** Delay after the mascot is ready before the first-time greeting appears. */
export const FORKINATOR_GREETING_AUTO_SHOW_DELAY_MS = 2000;

/** Auto-dismiss the greeting if the user does not interact. */
export const FORKINATOR_GREETING_AUTO_HIDE_MS = 8000;

export function readForkinatorGreetingShown(): boolean {
  return readJson<boolean>(FORKINATOR_GREETING_SHOWN_STORAGE_KEY, false) === true;
}

export function markForkinatorGreetingShown(): void {
  writeJson(FORKINATOR_GREETING_SHOWN_STORAGE_KEY, true);
}

export function shouldAutoShowForkinatorGreeting(
  greetingShown: boolean = readForkinatorGreetingShown(),
): boolean {
  return !greetingShown;
}

/** Which auto prompt may run this app session (greeting blocks scanner in the same session). */
export function forkinatorPromptSessionPlan(
  greetingShownPersisted: boolean,
  scannerEligible: boolean,
): { showGreeting: boolean; showScanner: boolean } {
  const showGreeting = !greetingShownPersisted;
  const showScanner = greetingShownPersisted && scannerEligible;
  return { showGreeting, showScanner };
}
