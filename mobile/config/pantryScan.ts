import {
  DEFAULT_PANTRY_STORAGE_LOCATION,
  isPantryStorageLocation,
  type PantryStorageLocation,
} from './pantryStorage';
import { readJson, writeJson } from '../lib/storage';

/** Last storage location chosen for a shelf scan (batch override or scan hint). */
export const PANTRY_LAST_SCAN_LOCATION_STORAGE_KEY = 'mealprep.pantryLastScanLocation';

export const PANTRY_SCAN_UI_COPY = {
  inventoryCardSubtitle: '🤳 Scan shelves with your camera to add items',
  scanShelf: 'Scan shelf',
  scanShelfA11y: 'Scan shelf with camera or photo library',
  scanCardTitle: 'Scan your fridge',
  scanCardSubtitle: 'Take a photo and Forky adds what he sees.',
  scanCardPlusBadge: 'Plus',
  receiptCardTitle: 'Scan a receipt',
  receiptCardSubtitle: 'Just shopped? Snap the receipt and Forky adds what you bought.',
  scanReceiptA11y: 'Scan a grocery receipt with camera or photo library',
  /** Shown above the review list for a receipt: some lines top up things already in the pantry. */
  receiptSummary: (found: number, already: number) =>
    already > 0
      ? `${found} item${found === 1 ? '' : 's'} from your receipt. ${already} top up things you already have.`
      : `${found} item${found === 1 ? '' : 's'} from your receipt.`,
  receiptNothingFoundTitle: 'No food items found',
  receiptNothingFound:
    'Forky could not read any food items on that receipt. Lay it flat in good light, fill the frame, and try again.',
  groceryTickedOff: (count: number) =>
    `Ticked ${count} item${count === 1 ? '' : 's'} off your grocery list.`,
  addItems: (count: number) => `Add ${count} item${count === 1 ? '' : 's'}`,
  addedToPantry: (count: number) =>
    `Added ${count} item${count === 1 ? '' : 's'} to pantry`,
  choosePhotoSourceTitle: 'Add shelf photo',
  choosePhotoSourceMessage: 'How do you want to add a photo?',
  takePhoto: 'Take photo',
  chooseFromLibrary: 'Choose from library',
  addAnotherPhoto: 'Add another photo',
  addAnotherPhotoBusy: 'Scanning photo…',
  noNewItemsInPhoto: 'No new items in that photo — try a different angle.',
  /** Shown above the review list when some of what the scan found is already in the pantry. */
  scanSummary: (found: number, already: number) =>
    `Found ${found} item${found === 1 ? '' : 's'}: ${found - already} new, ${already} already in your pantry.`,
  allAlreadyInPantryTitle: 'Nothing new in that photo',
  allAlreadyInPantry: (found: number) =>
    found === 1
      ? 'Forky found 1 item, and it is already in your pantry.'
      : `Forky found ${found} items, and all of them are already in your pantry.`,
  scanningPhotos: (count: number) => `Scanning ${count} photo${count === 1 ? '' : 's'}…`,
  scanningKeepGoing:
    'You can keep using the app, or add another photo. What Forky finds shows up here when it is ready.',
  moreStillScanning: (count: number) =>
    `${count} more photo${count === 1 ? ' is' : 's are'} still scanning. New items will be added to this list.`,
  tooManyScansTitle: 'Still scanning',
  tooManyScans: (max: number) => `${max} photos are already scanning. Add another when one finishes.`,
} as const;

export function readLastPantryScanLocation(): PantryStorageLocation {
  const saved = readJson<string | null>(PANTRY_LAST_SCAN_LOCATION_STORAGE_KEY, null);
  if (saved && isPantryStorageLocation(saved)) return saved;
  return DEFAULT_PANTRY_STORAGE_LOCATION;
}

export function writeLastPantryScanLocation(location: PantryStorageLocation): void {
  writeJson(PANTRY_LAST_SCAN_LOCATION_STORAGE_KEY, location);
}
