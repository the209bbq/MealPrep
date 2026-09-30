import type { PantryCategory } from '../types/mealprep';

export const PANTRY_STORAGE_LOCATIONS = ['pantry', 'fridge', 'spice_rack'] as const;
export type PantryStorageLocation = (typeof PANTRY_STORAGE_LOCATIONS)[number];

export const DEFAULT_PANTRY_STORAGE_LOCATION: PantryStorageLocation = 'pantry';

export const PANTRY_STORAGE_LOCATION_LABELS: Record<PantryStorageLocation, string> = {
  pantry: 'Pantry',
  fridge: 'Fridge',
  spice_rack: 'Spice rack',
};

export const PANTRY_SCAN_TIP = {
  message:
    'Tip: For best results, scan one shelf at a time—hold the phone close, use good light, and keep labels facing the camera.',
  dismissStorageKey: 'mealprep.pantryScanTipDismissed',
  /** Show the tip again on review when at or below this many detections. */
  fewItemsThreshold: 3,
} as const;

export const PANTRY_SECTION_EXPANDED_STORAGE_KEY = 'mealprep.pantrySectionExpanded';

export const DEFAULT_PANTRY_SECTION_EXPANDED: Record<PantryStorageLocation, boolean> = {
  pantry: true,
  fridge: true,
  spice_rack: true,
};

const LEGACY_FRIDGE_PATTERN = /\bfridge\b|\brefrigerator\b/i;
const LEGACY_SPICE_PATTERN = /\bspice[\s_-]?rack\b|\bspice_rack\b/i;

export function isPantryStorageLocation(value: string): value is PantryStorageLocation {
  return (PANTRY_STORAGE_LOCATIONS as readonly string[]).includes(value);
}

/** Map DB / legacy free-text values to canonical storage keys. Null and empty count as pantry. */
export function normalizePantryStorageLocation(raw: string | null | undefined): PantryStorageLocation {
  const trimmed = (raw ?? '').trim();
  if (!trimmed || trimmed.toLowerCase() === 'pantry') {
    return DEFAULT_PANTRY_STORAGE_LOCATION;
  }
  if (isPantryStorageLocation(trimmed)) {
    return trimmed;
  }
  const lower = trimmed.toLowerCase();
  if (lower === 'fridge' || lower === 'refrigerator' || LEGACY_FRIDGE_PATTERN.test(trimmed)) {
    return 'fridge';
  }
  if (lower === 'spice_rack' || lower === 'spice rack' || LEGACY_SPICE_PATTERN.test(trimmed)) {
    return 'spice_rack';
  }
  return DEFAULT_PANTRY_STORAGE_LOCATION;
}

export function labelForPantryStorageLocation(location: PantryStorageLocation): string {
  return PANTRY_STORAGE_LOCATION_LABELS[location];
}

export function suggestStorageLocationForCategory(category: PantryCategory): PantryStorageLocation {
  switch (category) {
    case 'spices':
      return 'spice_rack';
    case 'dairy':
    case 'produce':
    case 'meats':
    case 'frozen':
      return 'fridge';
    default:
      return DEFAULT_PANTRY_STORAGE_LOCATION;
  }
}

export function pantryStorageLocationOptions(): Array<{ id: PantryStorageLocation; label: string }> {
  return PANTRY_STORAGE_LOCATIONS.map((id) => ({
    id,
    label: PANTRY_STORAGE_LOCATION_LABELS[id],
  }));
}

export function normalizePantryItemLocation<T extends { location: PantryStorageLocation | string }>(
  item: T,
): T & { location: PantryStorageLocation } {
  return {
    ...item,
    location: normalizePantryStorageLocation(String(item.location)),
  };
}

export function normalizePantryItemList<T extends { location: PantryStorageLocation | string }>(
  items: T[],
): Array<T & { location: PantryStorageLocation }> {
  return items.map((item) => normalizePantryItemLocation(item));
}
