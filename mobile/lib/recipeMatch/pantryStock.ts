import type { PantryItem, RecipeIngredient } from '../../types/mealprep';
import { convertQuantity } from '../units/conversion';
import { convertIngredientQuantity, ingredientUnitsConvertible } from '../units/ingredientUnitBridge';
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

export function isEggComponentIngredient(name: string): boolean {
  const normalized = normalizeIngredientName(name);
  if (!normalized) return false;
  if (normalized === 'egg' || normalized === 'eggs') return true;
  return (
    /\begg\s+(yolk|yolks|white|whites)\b/.test(normalized) ||
    normalized === 'egg yolk' ||
    normalized === 'egg white' ||
    normalized === 'egg yolks' ||
    normalized === 'egg whites'
  );
}

export function isEggsPantryStapleRow(item: PantryItem): boolean {
  if (item.ingredientId.startsWith('staple-eggs')) return true;
  const name = normalizeIngredientName(item.name);
  return name === 'eggs' || name === 'egg';
}

function pantryItemMatchesIngredient(item: PantryItem, ingredient: RecipeIngredient): boolean {
  if (isEggComponentIngredient(ingredient.name) && isEggsPantryStapleRow(item)) {
    return true;
  }
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
  ingredientName?: string,
): number | null {
  if (items.length === 0) return 0;

  const name = ingredientName ?? items[0]?.name ?? '';
  let total = 0;
  for (const item of items) {
    const convertible = ingredientName
      ? ingredientUnitsConvertible(name, item.unit, targetUnit)
      : ingredientUnitsConvertible(item.name, item.unit, targetUnit);
    if (!convertible) {
      return null;
    }
    const converted = convertIngredientQuantity(item.quantity, item.unit, targetUnit, name || item.name);
    if (converted === null) {
      const fallback = convertQuantity(item.quantity, item.unit, targetUnit);
      if (fallback === null) return null;
      total += fallback;
    } else {
      total += converted;
    }
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

  const have = totalPantryQuantityInUnit(matches, ingredient.unit, ingredient.name);
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
