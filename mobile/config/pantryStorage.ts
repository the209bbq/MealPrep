import type { PantryCategory, PantryItem } from '../types/mealprep';

export const PANTRY_STORAGE_LOCATIONS = ['pantry', 'fridge', 'spice_rack'] as const;
export type PantryStorageLocation = (typeof PANTRY_STORAGE_LOCATIONS)[number];

export const DEFAULT_PANTRY_STORAGE_LOCATION: PantryStorageLocation = 'pantry';

export const PANTRY_STORAGE_LOCATION_LABELS: Record<PantryStorageLocation, string> = {
  pantry: 'Pantry',
  fridge: 'Fridge',
  spice_rack: 'Spice rack',
};

/** Ionicons glyph names for storage-specific scan actions (add a location in PANTRY_STORAGE_LOCATIONS to extend). */
export const PANTRY_STORAGE_SCAN_ICONS: Record<PantryStorageLocation, string> = {
  pantry: 'file-tray-stacked-outline',
  fridge: 'snow-outline',
  spice_rack: 'leaf-outline',
};

export interface PantryStorageScanAction {
  location: PantryStorageLocation;
  label: string;
  /** e.g. "Scan pantry", "Scan spice rack" */
  scanTitle: string;
  icon: string;
}

export function pantryStorageScanActions(): PantryStorageScanAction[] {
  return PANTRY_STORAGE_LOCATIONS.map((location) => ({
    location,
    label: PANTRY_STORAGE_LOCATION_LABELS[location],
    scanTitle: `Scan ${PANTRY_STORAGE_LOCATION_LABELS[location].toLowerCase()}`,
    icon: PANTRY_STORAGE_SCAN_ICONS[location],
  }));
}

export const PANTRY_SCAN_TIP = {
  message:
    'Tip: For best results, scan one shelf at a time — hold the phone close, use good light, and keep labels facing the camera.',
  dismissStorageKey: 'mealprep.pantryScanTipDismissed',
  /** Show the tip again on review when at or below this many detections. */
  fewItemsThreshold: 3,
} as const;

/** Last selected location tab on the Pantry screen (`all` or a storage location). */
export const PANTRY_LOCATION_FILTER_STORAGE_KEY = 'mealprep.pantryLocationFilter';

export const PANTRY_LIST_COPY = {
  emptyFiltered: 'No items match your filters.',
  showAllFilters: 'Show all locations and categories',
  storageFilterLabel: 'Storage',
  allLocationsChipLabel: 'All',
} as const;

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

/** Phrase lists — longer phrases are checked first within each list. */
const SPICE_RACK_PHRASES = [
  'garlic powder',
  'onion powder',
  'chili powder',
  'smoked paprika',
  'dried basil',
  'dried oregano',
  'dried thyme',
  'dried parsley',
  'dried herb',
  'dried herbs',
  'bay leaf',
  'bay leaves',
  'seasoning',
  'seasonings',
  'allspice',
  'paprika',
  'cumin',
  'turmeric',
  'coriander',
  'cardamom',
  'nutmeg',
  'cinnamon',
  'oregano',
  'rosemary',
  'thyme',
  'basil',
  'parsley',
  'cayenne',
  'clove',
  'cloves',
  'curry powder',
  'garam masala',
  'five spice',
  'peppercorn',
  'peppercorns',
  'spice',
  'spices',
] as const;

const FRIDGE_PHRASES = [
  'chicken breast',
  'chicken thigh',
  'ground beef',
  'ground turkey',
  'leftover',
  'leftovers',
  'sour cream',
  'cream cheese',
  'half and half',
  'heavy cream',
  'whipping cream',
  'greek yogurt',
  'cottage cheese',
  'string cheese',
  'shredded cheese',
  'fish fillet',
  'salmon fillet',
  'fresh salmon',
  'fresh fish',
  'fresh meat',
  'deli meat',
  'lunch meat',
  'rotisserie chicken',
  'tofu',
  'tempeh',
  'hummus',
  'fresh salsa',
  'guacamole',
  'lettuce',
  'spinach',
  'kale',
  'arugula',
  'broccoli',
  'cauliflower',
  'carrot',
  'carrots',
  'celery',
  'cucumber',
  'bell pepper',
  'mushroom',
  'mushrooms',
  'berries',
  'strawberr',
  'blueberr',
  'grape',
  'apple',
  'orange',
  'lemon',
  'lime',
  'avocado',
  'zucchini',
  'asparagus',
  'green bean',
  'fresh herb',
  'cilantro bunch',
  'parsley bunch',
  'fresh basil',
  'milk',
  'buttermilk',
  'egg',
  'eggs',
  'butter',
  'margarine',
  'cheese',
  'yogurt',
  'mayonnaise',
  'mayo',
  'ketchup',
  'mustard',
  'relish',
  'pickle',
  'pickles',
  'salsa',
  'opened',
  'open jar',
  'refrigerate',
  'refrigerated',
  'keep cold',
  'after opening',
] as const;

const PANTRY_SHELF_STABLE_PHRASES = [
  'shelf stable',
  'shelf-stable',
  'unopened',
  'sealed',
  'canned',
  'can of',
  'tin of',
  'dry goods',
  'peanut butter',
  'almond butter',
  'nut butter',
  'syrup',
  'maple syrup',
  'pancake syrup',
  'honey',
  'jam',
  'jelly',
  'preserves',
  'onion',
  'onions',
  'garlic',
  'potato',
  'potatoes',
  'cereal',
  'oatmeal',
  'oats',
  'granola',
  'flour',
  'sugar',
  'brown sugar',
  'baking powder',
  'baking soda',
  'yeast',
  'cornstarch',
  'rice',
  'pasta',
  'spaghetti',
  'noodles',
  'quinoa',
  'lentils',
  'beans',
  'chickpeas',
  'cracker',
  'crackers',
  'chips',
  'pretzel',
  'snack',
  'olive oil',
  'vegetable oil',
  'canola oil',
  'coconut oil',
  'vinegar',
  'soy sauce',
  'hot sauce',
  'worcestershire',
  'bbq sauce',
  'barbecue sauce',
  'tomato sauce',
  'tomato paste',
  'crushed tomato',
  'diced tomato',
  'shelf stable dressing',
  'salad dressing',
  'ranch dressing',
  'italian dressing',
  'vinaigrette',
  'bread',
  'bagel',
  'tortilla',
  'tortillas',
  'pita',
  'bun',
  'buns',
  'roll',
  'rolls',
] as const;

function normalizeNameForStorage(name: string): string {
  return name
    .toLowerCase()
    .replace(/\[demo sample\]/gi, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameIncludesPhrase(normalizedName: string, phrase: string): boolean {
  return normalizedName.includes(phrase.toLowerCase());
}

function nameIncludesAnyPhrase(normalizedName: string, phrases: readonly string[]): boolean {
  for (const phrase of phrases) {
    if (nameIncludesPhrase(normalizedName, phrase)) return true;
  }
  return false;
}

/** Vision API storage string → canonical location (undefined if invalid / missing). */
export function parseVisionStorageField(raw: unknown): PantryStorageLocation | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === 'pantry' || trimmed === 'fridge' || trimmed === 'spice_rack' || trimmed === 'spice rack') {
    return normalizePantryStorageLocation(trimmed);
  }
  return undefined;
}

/**
 * Deterministic storage suggestion from item name + category.
 * Used when Gemini omits `storage` and for Re-sort on default-pantry rows.
 */
export function suggestStorageLocationForPantryItem(
  name: string,
  category: PantryCategory,
): PantryStorageLocation {
  const normalized = normalizeNameForStorage(name);

  if (category === 'spices' || nameIncludesAnyPhrase(normalized, SPICE_RACK_PHRASES)) {
    return 'spice_rack';
  }

  if (nameIncludesAnyPhrase(normalized, PANTRY_SHELF_STABLE_PHRASES)) {
    const needsFridgeAfterOpen =
      nameIncludesPhrase(normalized, 'opened') ||
      nameIncludesPhrase(normalized, 'refrigerate') ||
      nameIncludesPhrase(normalized, 'after opening');
    if (!needsFridgeAfterOpen) {
      return DEFAULT_PANTRY_STORAGE_LOCATION;
    }
  }

  if (category === 'dairy' || category === 'meats' || category === 'produce' || category === 'frozen') {
    return 'fridge';
  }

  if (nameIncludesAnyPhrase(normalized, FRIDGE_PHRASES)) {
    return 'fridge';
  }

  if (category === 'condiments') {
    return DEFAULT_PANTRY_STORAGE_LOCATION;
  }

  return suggestStorageLocationForCategory(category);
}

export interface PantryResortPreview {
  total: number;
  toFridge: number;
  toSpiceRack: number;
}

/** Count how many default-pantry rows would move under keyword mapping. */
export function previewResortFromDefaultPantry(items: PantryItem[]): PantryResortPreview {
  let toFridge = 0;
  let toSpiceRack = 0;
  for (const item of items) {
    if (item.location !== DEFAULT_PANTRY_STORAGE_LOCATION) continue;
    const next = suggestStorageLocationForPantryItem(item.name, item.category);
    if (next === 'fridge') toFridge += 1;
    else if (next === 'spice_rack') toSpiceRack += 1;
  }
  return { total: toFridge + toSpiceRack, toFridge, toSpiceRack };
}

export function resortPantryItemIfDefault(item: PantryItem): PantryItem {
  if (item.location !== DEFAULT_PANTRY_STORAGE_LOCATION) return item;
  const next = suggestStorageLocationForPantryItem(item.name, item.category);
  if (next === item.location) return item;
  return { ...item, location: next, updatedAt: new Date().toISOString() };
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
