import type { PantryItem, RecipeIngredient } from '../../types/mealprep';
import { convertQuantity, unitsAreConvertible } from '../units/conversion';
import { expandSynonymKeys, fuzzyNameScore, normalizeIngredientName } from './normalize';
import { FUZZY_MATCH_THRESHOLD } from '../../config/recipeMatchingConfig';

function pantryLookupKeys(item: PantryItem): string[] {
  const keys = new Set<string>();
  keys.add(item.ingredientId);
  keys.add(normalizeIngredientName(item.ingredientId.replace(/-/g, ' ')));
  for (const k of expandSynonymKeys(item.name)) keys.add(k);
  for (const k of expandSynonymKeys(item.ingredientId.replace(/-/g, ' '))) keys.add(k);
  return [...keys];
}

function ingredientLookupKeys(ing: RecipeIngredient): string[] {
  const keys = new Set<string>();
  keys.add(ing.ingredientId);
  keys.add(normalizeIngredientName(ing.ingredientId.replace(/-/g, ' ')));
  for (const k of expandSynonymKeys(ing.name)) keys.add(k);
  return [...keys];
}

function keysOverlap(ingKeys: string[], pantryKeys: string[]): boolean {
  const pantrySet = new Set(pantryKeys.filter(Boolean));
  for (const ik of ingKeys) {
    if (ik && pantrySet.has(ik)) return true;
  }
  return false;
}

function pantryItemMatchesIngredient(item: PantryItem, ingredient: RecipeIngredient): boolean {
  if (item.ingredientId === ingredient.ingredientId) return true;
  const ingKeys = ingredientLookupKeys(ingredient);
  const pantryKeys = pantryLookupKeys(item);
  if (keysOverlap(ingKeys, pantryKeys)) return true;

  const fuzzy = Math.max(
    fuzzyNameScore(ingredient.name, item.name),
    fuzzyNameScore(ingredient.name, item.ingredientId.replace(/-/g, ' ')),
    fuzzyNameScore(ingredient.ingredientId.replace(/-/g, ' '), item.name),
  );
  return fuzzy >= FUZZY_MATCH_THRESHOLD;
}

/** All pantry rows that satisfy the same name/id rules as recipe matching. */
export function findPantryItemsForIngredient(
  ingredient: RecipeIngredient,
  pantry: PantryItem[],
): PantryItem[] {
  return pantry.filter((item) => pantryItemMatchesIngredient(item, ingredient));
}

function roundQty(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Sum matching pantry stock expressed in `targetUnit`, or null if units cannot be combined. */
export function totalPantryQuantityInUnit(
  items: PantryItem[],
  targetUnit: string,
): number | null {
  if (items.length === 0) return 0;

  let total = 0;
  for (const item of items) {
    if (!unitsAreConvertible(item.unit, targetUnit)) {
      return null;
    }
    const converted = convertQuantity(item.quantity, item.unit, targetUnit);
    if (converted === null) return null;
    total += converted;
  }
  return roundQty(total);
}

export interface IngredientShortfall {
  ingredient: RecipeIngredient;
  /** Quantity still needed in `ingredient.unit`. */
  missingQuantity: number;
  matchedPantryItem: PantryItem | null;
}

export function ingredientShortfall(
  ingredient: RecipeIngredient,
  pantry: PantryItem[],
  neededQuantity: number,
): IngredientShortfall | null {
  const matches = findPantryItemsForIngredient(ingredient, pantry);
  if (matches.length === 0) {
    return {
      ingredient,
      missingQuantity: roundQty(neededQuantity),
      matchedPantryItem: null,
    };
  }

  const have = totalPantryQuantityInUnit(matches, ingredient.unit);
  if (have === null) {
    return null;
  }

  const missingQuantity = roundQty(Math.max(0, neededQuantity - have));
  if (missingQuantity <= 0) {
    return null;
  }

  return {
    ingredient: { ...ingredient, quantity: missingQuantity },
    missingQuantity,
    matchedPantryItem: matches[0] ?? null,
  };
}
