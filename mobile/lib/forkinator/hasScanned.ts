import { readJson, writeJson } from '../storage';

export const FORKINATOR_HAS_SCANNED_STORAGE_KEY = 'mealprep.forkinator.hasScanned';

export function readForkinatorHasScanned(): boolean {
  return readJson<boolean>(FORKINATOR_HAS_SCANNED_STORAGE_KEY, false) === true;
}

export function writeForkinatorHasScanned(hasScanned: boolean): void {
  writeJson(FORKINATOR_HAS_SCANNED_STORAGE_KEY, hasScanned);
}

export function markForkinatorPantryScanCompleted(): void {
  writeForkinatorHasScanned(true);
}
