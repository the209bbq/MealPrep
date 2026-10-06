import type { PantryCategory } from '../../types/mealprep';
import { estimateExpiryFromShelfLife } from './expiry';
import {
  suggestStorageLocationForCategory,
  suggestStorageLocationForPantryItem,
} from '../../config/pantryStorage';
import type { PantryItem } from '../../types/mealprep';

export const STAPLE_STORE_SECTIONS = [
  'produce',
  'dairy_eggs',
  'meat',
  'pantry_dry',
  'spices_oils',
  'frozen',
  'bakery',
] as const;

export type StapleStoreSection = (typeof STAPLE_STORE_SECTIONS)[number];

export const STAPLE_SECTION_LABELS: Record<StapleStoreSection, string> = {
  produce: 'Produce',
  dairy_eggs: 'Dairy & eggs',
  meat: 'Meat',
  pantry_dry: 'Pantry / dry goods',
  spices_oils: 'Spices & oils',
  frozen: 'Frozen',
  bakery: 'Bakery',
};

export interface StapleSizeOption {
  id: string;
  label: string;
  quantity: number;
  unit: string;
}

export interface StapleCatalogEntry {
  id: string;
  name: string;
  emoji: string;
  category: PantryCategory;
  section: StapleStoreSection;
  defaultQuantity: number;
  defaultUnit: string;
  sizeOptions?: StapleSizeOption[];
  defaultSizeId?: string;
  perishable?: boolean;
  /** Typical shelf life in days for default expiry chip. */
  shelfLifeDays?: number;
}

export interface StapleSelectionState {
  stapleId: string;
  sizeOptionId?: string;
  /** `YYYY-MM-DD` or null when user skipped expiry. */
  expiresOn?: string | null;
  /** When true, expiry row was shown and user explicitly cleared it. */
  expirySkipped?: boolean;
}

const MILK_SIZES: StapleSizeOption[] = [
  { id: 'gallon', label: 'Gallon', quantity: 1, unit: 'gal' },
  { id: 'half_gallon', label: 'Half gal', quantity: 0.5, unit: 'gal' },
  { id: 'quart', label: 'Quart', quantity: 1, unit: 'qt' },
];

const EGG_SIZES: StapleSizeOption[] = [
  { id: '6', label: '6 ct', quantity: 6, unit: 'each' },
  { id: '12', label: '12 ct', quantity: 12, unit: 'each' },
  { id: '18', label: '18 ct', quantity: 18, unit: 'each' },
];

const BUTTER_SIZES: StapleSizeOption[] = [
  { id: 'stick', label: '1 stick', quantity: 1, unit: 'stick' },
  { id: 'lb', label: '1 lb', quantity: 1, unit: 'lb' },
];

const BREAD_SIZES: StapleSizeOption[] = [{ id: 'loaf', label: 'Loaf', quantity: 1, unit: 'loaf' }];

const BAG_SIZES: StapleSizeOption[] = [
  { id: 'small', label: '2 lb bag', quantity: 2, unit: 'lb' },
  { id: 'medium', label: '5 lb bag', quantity: 5, unit: 'lb' },
  { id: 'large', label: '10 lb bag', quantity: 10, unit: 'lb' },
];

const OIL_SIZES: StapleSizeOption[] = [
  { id: '16oz', label: '16 oz', quantity: 16, unit: 'oz' },
  { id: '32oz', label: '32 oz', quantity: 32, unit: 'oz' },
  { id: '48oz', label: '48 oz', quantity: 48, unit: 'oz' },
];

export const STAPLE_CATALOG: StapleCatalogEntry[] = [
  { id: 'onions', name: 'Onions', emoji: '🧅', category: 'produce', section: 'produce', defaultQuantity: 3, defaultUnit: 'each', perishable: true, shelfLifeDays: 21 },
  { id: 'garlic', name: 'Garlic', emoji: '🧄', category: 'produce', section: 'produce', defaultQuantity: 1, defaultUnit: 'head', perishable: true, shelfLifeDays: 21 },
  { id: 'potatoes', name: 'Potatoes', emoji: '🥔', category: 'produce', section: 'produce', defaultQuantity: 5, defaultUnit: 'lb', perishable: true, shelfLifeDays: 14 },
  { id: 'carrots', name: 'Carrots', emoji: '🥕', category: 'produce', section: 'produce', defaultQuantity: 1, defaultUnit: 'lb', perishable: true, shelfLifeDays: 14 },
  { id: 'celery', name: 'Celery', emoji: '🥬', category: 'produce', section: 'produce', defaultQuantity: 1, defaultUnit: 'bunch', perishable: true, shelfLifeDays: 10 },
  { id: 'bell_peppers', name: 'Bell peppers', emoji: '🫑', category: 'produce', section: 'produce', defaultQuantity: 3, defaultUnit: 'each', perishable: true, shelfLifeDays: 7 },
  { id: 'tomatoes', name: 'Tomatoes', emoji: '🍅', category: 'produce', section: 'produce', defaultQuantity: 4, defaultUnit: 'each', perishable: true, shelfLifeDays: 5 },
  { id: 'lettuce', name: 'Lettuce', emoji: '🥗', category: 'produce', section: 'produce', defaultQuantity: 1, defaultUnit: 'head', perishable: true, shelfLifeDays: 5 },
  { id: 'spinach', name: 'Spinach', emoji: '🍃', category: 'produce', section: 'produce', defaultQuantity: 1, defaultUnit: 'bag', perishable: true, shelfLifeDays: 5 },
  { id: 'bananas', name: 'Bananas', emoji: '🍌', category: 'produce', section: 'produce', defaultQuantity: 1, defaultUnit: 'bunch', perishable: true, shelfLifeDays: 5 },
  { id: 'apples', name: 'Apples', emoji: '🍎', category: 'produce', section: 'produce', defaultQuantity: 6, defaultUnit: 'each', perishable: true, shelfLifeDays: 14 },
  { id: 'lemons', name: 'Lemons', emoji: '🍋', category: 'produce', section: 'produce', defaultQuantity: 4, defaultUnit: 'each', perishable: true, shelfLifeDays: 14 },
  { id: 'avocados', name: 'Avocados', emoji: '🥑', category: 'produce', section: 'produce', defaultQuantity: 4, defaultUnit: 'each', perishable: true, shelfLifeDays: 4 },
  { id: 'broccoli', name: 'Broccoli', emoji: '🥦', category: 'produce', section: 'produce', defaultQuantity: 1, defaultUnit: 'head', perishable: true, shelfLifeDays: 5 },
  { id: 'cucumber', name: 'Cucumber', emoji: '🥒', category: 'produce', section: 'produce', defaultQuantity: 2, defaultUnit: 'each', perishable: true, shelfLifeDays: 7 },

  {
    id: 'milk',
    name: 'Milk',
    emoji: '🥛',
    category: 'dairy',
    section: 'dairy_eggs',
    defaultQuantity: 1,
    defaultUnit: 'gal',
    sizeOptions: MILK_SIZES,
    defaultSizeId: 'gallon',
    perishable: true,
    shelfLifeDays: 7,
  },
  {
    id: 'eggs',
    name: 'Eggs',
    emoji: '🥚',
    category: 'dairy',
    section: 'dairy_eggs',
    defaultQuantity: 12,
    defaultUnit: 'each',
    sizeOptions: EGG_SIZES,
    defaultSizeId: '12',
    perishable: true,
    shelfLifeDays: 21,
  },
  {
    id: 'butter',
    name: 'Butter',
    emoji: '🧈',
    category: 'dairy',
    section: 'dairy_eggs',
    defaultQuantity: 1,
    defaultUnit: 'lb',
    sizeOptions: BUTTER_SIZES,
    defaultSizeId: 'lb',
    perishable: true,
    shelfLifeDays: 30,
  },
  {
    id: 'cheddar',
    name: 'Cheddar cheese',
    emoji: '🧀',
    category: 'dairy',
    section: 'dairy_eggs',
    defaultQuantity: 8,
    defaultUnit: 'oz',
    perishable: true,
    shelfLifeDays: 14,
  },
  {
    id: 'yogurt',
    name: 'Yogurt',
    emoji: '🥣',
    category: 'dairy',
    section: 'dairy_eggs',
    defaultQuantity: 32,
    defaultUnit: 'oz',
    perishable: true,
    shelfLifeDays: 14,
  },
  { id: 'sour_cream', name: 'Sour cream', emoji: '🥄', category: 'dairy', section: 'dairy_eggs', defaultQuantity: 16, defaultUnit: 'oz', perishable: true, shelfLifeDays: 14 },
  { id: 'cream_cheese', name: 'Cream cheese', emoji: '🧀', category: 'dairy', section: 'dairy_eggs', defaultQuantity: 8, defaultUnit: 'oz', perishable: true, shelfLifeDays: 14 },

  { id: 'chicken_breast', name: 'Chicken breast', emoji: '🍗', category: 'meats', section: 'meat', defaultQuantity: 2, defaultUnit: 'lb', perishable: true, shelfLifeDays: 3 },
  { id: 'ground_beef', name: 'Ground beef', emoji: '🥩', category: 'meats', section: 'meat', defaultQuantity: 1, defaultUnit: 'lb', perishable: true, shelfLifeDays: 3 },
  { id: 'bacon', name: 'Bacon', emoji: '🥓', category: 'meats', section: 'meat', defaultQuantity: 12, defaultUnit: 'oz', perishable: true, shelfLifeDays: 7 },
  { id: 'sausage', name: 'Sausage', emoji: '🌭', category: 'meats', section: 'meat', defaultQuantity: 1, defaultUnit: 'lb', perishable: true, shelfLifeDays: 5 },
  { id: 'salmon', name: 'Salmon', emoji: '🐟', category: 'meats', section: 'meat', defaultQuantity: 1, defaultUnit: 'lb', perishable: true, shelfLifeDays: 2 },

  {
    id: 'rice',
    name: 'Rice',
    emoji: '🍚',
    category: 'dry_goods',
    section: 'pantry_dry',
    defaultQuantity: 5,
    defaultUnit: 'lb',
    sizeOptions: BAG_SIZES,
    defaultSizeId: 'medium',
  },
  {
    id: 'flour',
    name: 'Flour',
    emoji: '🌾',
    category: 'dry_goods',
    section: 'pantry_dry',
    defaultQuantity: 5,
    defaultUnit: 'lb',
    sizeOptions: BAG_SIZES,
    defaultSizeId: 'medium',
  },
  {
    id: 'sugar',
    name: 'Sugar',
    emoji: '🍬',
    category: 'dry_goods',
    section: 'pantry_dry',
    defaultQuantity: 4,
    defaultUnit: 'lb',
    sizeOptions: BAG_SIZES,
    defaultSizeId: 'small',
  },
  { id: 'pasta', name: 'Pasta', emoji: '🍝', category: 'dry_goods', section: 'pantry_dry', defaultQuantity: 1, defaultUnit: 'lb' },
  { id: 'canned_beans', name: 'Canned beans', emoji: '🫘', category: 'dry_goods', section: 'pantry_dry', defaultQuantity: 2, defaultUnit: 'can' },
  { id: 'canned_tomatoes', name: 'Canned tomatoes', emoji: '🥫', category: 'dry_goods', section: 'pantry_dry', defaultQuantity: 2, defaultUnit: 'can' },
  { id: 'peanut_butter', name: 'Peanut butter', emoji: '🥜', category: 'dry_goods', section: 'pantry_dry', defaultQuantity: 16, defaultUnit: 'oz' },
  { id: 'oats', name: 'Oats', emoji: '🥣', category: 'dry_goods', section: 'pantry_dry', defaultQuantity: 42, defaultUnit: 'oz' },
  { id: 'cereal', name: 'Cereal', emoji: '🥣', category: 'dry_goods', section: 'pantry_dry', defaultQuantity: 1, defaultUnit: 'box' },
  { id: 'broth', name: 'Broth', emoji: '🍲', category: 'dry_goods', section: 'pantry_dry', defaultQuantity: 32, defaultUnit: 'oz' },
  { id: 'honey', name: 'Honey', emoji: '🍯', category: 'dry_goods', section: 'pantry_dry', defaultQuantity: 12, defaultUnit: 'oz' },

  {
    id: 'olive_oil',
    name: 'Olive oil',
    emoji: '🫒',
    category: 'condiments',
    section: 'spices_oils',
    defaultQuantity: 16,
    defaultUnit: 'oz',
    sizeOptions: OIL_SIZES,
    defaultSizeId: '16oz',
  },
  {
    id: 'vegetable_oil',
    name: 'Vegetable oil',
    emoji: '🛢️',
    category: 'condiments',
    section: 'spices_oils',
    defaultQuantity: 48,
    defaultUnit: 'oz',
    sizeOptions: OIL_SIZES,
    defaultSizeId: '48oz',
  },
  { id: 'salt', name: 'Salt', emoji: '🧂', category: 'spices', section: 'spices_oils', defaultQuantity: 26, defaultUnit: 'oz' },
  { id: 'black_pepper', name: 'Black pepper', emoji: '⚫', category: 'spices', section: 'spices_oils', defaultQuantity: 2, defaultUnit: 'oz' },
  { id: 'garlic_powder', name: 'Garlic powder', emoji: '🧄', category: 'spices', section: 'spices_oils', defaultQuantity: 3, defaultUnit: 'oz' },
  { id: 'paprika', name: 'Paprika', emoji: '🌶️', category: 'spices', section: 'spices_oils', defaultQuantity: 2, defaultUnit: 'oz' },
  { id: 'cumin', name: 'Cumin', emoji: '🌿', category: 'spices', section: 'spices_oils', defaultQuantity: 2, defaultUnit: 'oz' },
  { id: 'soy_sauce', name: 'Soy sauce', emoji: '🍶', category: 'condiments', section: 'spices_oils', defaultQuantity: 15, defaultUnit: 'oz' },
  { id: 'vinegar', name: 'Vinegar', emoji: '🍾', category: 'condiments', section: 'spices_oils', defaultQuantity: 16, defaultUnit: 'oz' },

  { id: 'frozen_veg', name: 'Frozen vegetables', emoji: '🥦', category: 'frozen', section: 'frozen', defaultQuantity: 1, defaultUnit: 'bag' },
  { id: 'frozen_berries', name: 'Frozen berries', emoji: '🫐', category: 'frozen', section: 'frozen', defaultQuantity: 1, defaultUnit: 'bag' },
  { id: 'ice_cream', name: 'Ice cream', emoji: '🍦', category: 'frozen', section: 'frozen', defaultQuantity: 1, defaultUnit: 'pint', perishable: true, shelfLifeDays: 60 },
  { id: 'frozen_pizza', name: 'Frozen pizza', emoji: '🍕', category: 'frozen', section: 'frozen', defaultQuantity: 1, defaultUnit: 'each' },

  {
    id: 'bread',
    name: 'Bread',
    emoji: '🍞',
    category: 'dry_goods',
    section: 'bakery',
    defaultQuantity: 1,
    defaultUnit: 'loaf',
    sizeOptions: BREAD_SIZES,
    defaultSizeId: 'loaf',
    perishable: true,
    shelfLifeDays: 5,
  },
  { id: 'tortillas', name: 'Tortillas', emoji: '🌮', category: 'dry_goods', section: 'bakery', defaultQuantity: 10, defaultUnit: 'each', perishable: true, shelfLifeDays: 10 },
  { id: 'bagels', name: 'Bagels', emoji: '🥯', category: 'dry_goods', section: 'bakery', defaultQuantity: 6, defaultUnit: 'each', perishable: true, shelfLifeDays: 5 },
];

const catalogById = new Map(STAPLE_CATALOG.map((entry) => [entry.id, entry]));

export function getStapleById(id: string): StapleCatalogEntry | undefined {
  return catalogById.get(id);
}

export function staplesBySection(): { section: StapleStoreSection; label: string; items: StapleCatalogEntry[] }[] {
  return STAPLE_STORE_SECTIONS.map((section) => ({
    section,
    label: STAPLE_SECTION_LABELS[section],
    items: STAPLE_CATALOG.filter((entry) => entry.section === section),
  }));
}

export function defaultStapleSelection(staple: StapleCatalogEntry, now = new Date()): StapleSelectionState {
  const selection: StapleSelectionState = { stapleId: staple.id };
  if (staple.defaultSizeId) {
    selection.sizeOptionId = staple.defaultSizeId;
  }
  if (staple.perishable && staple.shelfLifeDays) {
    selection.expiresOn = estimateExpiryFromShelfLife(staple.shelfLifeDays, now);
  }
  return selection;
}

export function resolveStapleQuantityUnit(
  staple: StapleCatalogEntry,
  selection: StapleSelectionState,
): { quantity: number; unit: string } {
  const sizeId = selection.sizeOptionId ?? staple.defaultSizeId;
  const size = staple.sizeOptions?.find((opt) => opt.id === sizeId);
  if (size) {
    return { quantity: size.quantity, unit: size.unit };
  }
  return { quantity: staple.defaultQuantity, unit: staple.defaultUnit };
}

function newPantryRowId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `00000000-0000-4000-8000-${Math.random().toString(16).slice(2, 14)}${Math.random().toString(16).slice(2, 6)}`;
}

export function stapleSelectionToPantryItem(
  selection: StapleSelectionState,
  now = new Date().toISOString(),
): PantryItem | null {
  const staple = getStapleById(selection.stapleId);
  if (!staple) return null;
  const { quantity, unit } = resolveStapleQuantityUnit(staple, selection);
  const expiresOn =
    selection.expirySkipped ? null : selection.expiresOn !== undefined ? selection.expiresOn : staple.perishable && staple.shelfLifeDays
      ? estimateExpiryFromShelfLife(staple.shelfLifeDays)
      : null;

  return {
    id: newPantryRowId(),
    ingredientId: `staple-${staple.id}`,
    name: staple.name,
    category: staple.category,
    quantity,
    unit,
    location: suggestStorageLocationForPantryItem(staple.name, staple.category),
    photoUri: null,
    expiresOn,
    updatedAt: now,
  };
}

export function stapleSelectionsToPantryItems(
  selections: StapleSelectionState[],
  now = new Date().toISOString(),
): PantryItem[] {
  return selections
    .map((selection) => stapleSelectionToPantryItem(selection, now))
    .filter((row): row is PantryItem => row !== null);
}

export const STAPLE_EXPIRY_QUICK_CHIPS = [
  { id: 'week1', label: '~1 week', days: 7 },
  { id: 'week2', label: '~2 weeks', days: 14 },
] as const;
