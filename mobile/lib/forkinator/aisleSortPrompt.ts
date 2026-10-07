import { readJson, writeJson } from '../storage';
import {
  markForkinatorPromptShownToday,
  shouldShowForkinatorPromptToday,
} from './forkinatorOncePerDay';

export const FORKINATOR_AISLE_SORT_USED_STORAGE_KEY = 'mealprep.forkinator.aisleSortUsed';
export const FORKINATOR_AISLE_SORT_PROMPT_LAST_SHOWN_DAY_KEY =
  'mealprep.forkinator.aisleSortPromptLastShownDay';

export function readForkinatorAisleSortUsed(): boolean {
  return readJson<boolean>(FORKINATOR_AISLE_SORT_USED_STORAGE_KEY, false) === true;
}

export function markForkinatorAisleSortUsed(): void {
  writeJson(FORKINATOR_AISLE_SORT_USED_STORAGE_KEY, true);
}

export function markForkinatorAisleSortPromptShown(now = new Date()): void {
  markForkinatorPromptShownToday(FORKINATOR_AISLE_SORT_PROMPT_LAST_SHOWN_DAY_KEY, now);
}

export type ForkinatorAisleSortPromptInput = {
  openGroceryItemCount: number;
  showMealGrouping: boolean;
  combineByAisle: boolean;
  aisleSortUsed?: boolean;
  now?: Date;
};

export function shouldAutoShowForkinatorAisleSortPrompt(
  input: ForkinatorAisleSortPromptInput,
): boolean {
  if (input.aisleSortUsed ?? readForkinatorAisleSortUsed()) return false;
  if (!input.showMealGrouping || input.combineByAisle) return false;
  if (input.openGroceryItemCount < 5) return false;
  return shouldShowForkinatorPromptToday(
    FORKINATOR_AISLE_SORT_PROMPT_LAST_SHOWN_DAY_KEY,
    input.now,
  );
}
