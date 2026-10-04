import { readJson, writeJson } from '../storage';

const STORAGE_KEY = 'mealprep.home.weekCalendarExpanded';

export function readHomeWeekCalendarExpanded(): boolean {
  return readJson(STORAGE_KEY, false);
}

export function writeHomeWeekCalendarExpanded(expanded: boolean): void {
  writeJson(STORAGE_KEY, expanded);
}
