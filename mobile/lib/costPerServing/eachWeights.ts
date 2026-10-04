import type { BasePriceEntry } from './types';

/**
 * Typical weight per count item (grams). Supplements `gramsEach` on table rows.
 * Sources: USDA FoodData Central typical retail sizes (approximate).
 */
export const EACH_WEIGHT_GRAMS_BY_ID: Readonly<Record<string, number>> = {
  onion_yellow: 227,
  garlic: 45,
  potato: 170,
  carrot: 61,
  celery: 40,
  broccoli: 148,
  cauliflower: 600,
  spinach: 30,
  lettuce_romaine: 500,
  tomato: 123,
  cucumber: 300,
  bell_pepper: 119,
  jalapeno: 14,
  mushroom: 18,
  zucchini: 196,
  squash_butternut: 680,
  sweet_potato: 130,
  corn: 180,
  green_beans: 4,
  asparagus: 16,
  avocado: 150,
  lemon: 58,
  lime: 44,
  apple: 182,
  banana: 118,
  cilantro: 5,
  parsley: 5,
  basil: 2,
  ginger: 28,
  green_onion: 15,
  chicken_breast: 174,
  chicken_thigh: 85,
  chicken_whole: 1814,
  eggs: 50,
  rotisserie_chicken: 907,
};

export function gramsEachForEntry(entry: BasePriceEntry): number | undefined {
  if (entry.gramsEach != null && entry.gramsEach > 0) return entry.gramsEach;
  return EACH_WEIGHT_GRAMS_BY_ID[entry.id];
}

/** Chopped / cooked cup weights when not set on the table row. */
export const GRAMS_PER_CUP_BY_ID: Readonly<Record<string, number>> = {
  broccoli: 91,
  cauliflower: 107,
  onion_yellow: 160,
  carrot: 128,
  celery: 101,
  bell_pepper: 149,
  mushroom: 70,
  spinach: 30,
  tomato: 180,
  green_beans: 100,
  zucchini: 124,
  cabbage: 89,
  beans_black: 172,
  beans_kidney: 177,
  chickpeas: 164,
  corn: 149,
  frozen_peas: 134,
  frozen_corn: 152,
  frozen_spinach: 190,
  cheddar: 113,
  mozzarella: 112,
  parmesan: 100,
  rice_white: 185,
  rice_brown: 195,
};

export function gramsPerCupForEntry(entry: BasePriceEntry): number | undefined {
  if (entry.gramsPerCup != null && entry.gramsPerCup > 0) return entry.gramsPerCup;
  return GRAMS_PER_CUP_BY_ID[entry.id];
}
