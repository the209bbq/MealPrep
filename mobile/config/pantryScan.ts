import {
  DEFAULT_PANTRY_STORAGE_LOCATION,
  isPantryStorageLocation,
  type PantryStorageLocation,
} from './pantryStorage';
import { readJson, writeJson } from '../lib/storage';

/** Last storage location chosen for a shelf scan (batch override or scan hint). */
export const PANTRY_LAST_SCAN_LOCATION_STORAGE_KEY = 'mealprep.pantryLastScanLocation';

export const PANTRY_SCAN_UI_COPY = {
  scanShelf: 'Scan shelf',
  scanShelfA11y: 'Scan shelf with camera or photo library',
  addItems: (count: number) => `Add ${count} item${count === 1 ? '' : 's'}`,
  addedToPantry: (count: number) =>
    `Added ${count} item${count === 1 ? '' : 's'} to pantry`,
  choosePhotoSourceTitle: 'Add shelf photo',
  choosePhotoSourceMessage: 'How do you want to add a photo?',
  takePhoto: 'Take photo',
  chooseFromLibrary: 'Choose from library',
} as const;

export function readLastPantryScanLocation(): PantryStorageLocation {
  const saved = readJson<string | null>(PANTRY_LAST_SCAN_LOCATION_STORAGE_KEY, null);
  if (saved && isPantryStorageLocation(saved)) return saved;
  return DEFAULT_PANTRY_STORAGE_LOCATION;
}

export function writeLastPantryScanLocation(location: PantryStorageLocation): void {
  writeJson(PANTRY_LAST_SCAN_LOCATION_STORAGE_KEY, location);
}
