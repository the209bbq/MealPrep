import { readJson, writeJson } from '../lib/storage';

export const PANTRY_STAPLES_PROMPT_DISMISSED_KEY = 'mealprep.pantryStaplesPromptDismissed';

export const PANTRY_STAPLES_COPY = {
  inviteTitle: 'Pick your staples',
  inviteSubtitle: 'Tap some staples in your house!',
  inviteCta: 'Pick staples',
  addStaplesLink: 'Add staples',
  screenTitle: 'Pick your staples',
  done: 'Done',
  skip: 'Skip',
  addedToast: (count: number) => `Added ${count} item${count === 1 ? '' : 's'} to your pantry`,
  pickDate: 'Pick date',
  varietyHeading: 'Type',
} as const;

export function readPantryStaplesPromptDismissed(): boolean {
  return readJson<boolean>(PANTRY_STAPLES_PROMPT_DISMISSED_KEY, false);
}

export function writePantryStaplesPromptDismissed(dismissed: boolean): void {
  writeJson(PANTRY_STAPLES_PROMPT_DISMISSED_KEY, dismissed);
}
