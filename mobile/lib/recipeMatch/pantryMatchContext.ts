import type { PantryItem } from '../../types/mealprep';
import { fuzzyNameScore, ingredientMatchScore, normalizeIngredientName, tokenizeIngredientName } from './normalize';

export interface PantryItemMatchTokens {
  item: PantryItem;
  nameTokens: string[];
  idAsNameTokens: string[];
}

export interface PantryMatchContext {
  key: string;
  items: PantryItemMatchTokens[];
}

let cachedContext: PantryMatchContext | null = null;

function pantryContextKey(pantry: PantryItem[]): string {
  return pantry.map((row) => `${row.id}:${row.name}:${row.ingredientId}:${row.quantity}:${row.unit}`).join('|');
}

/** Pre-tokenize pantry rows once per pantry revision (used by recipe scoring hot path). */
export function getPantryMatchContext(pantry: PantryItem[]): PantryMatchContext {
  const key = pantryContextKey(pantry);
  if (cachedContext?.key === key) return cachedContext;
  cachedContext = {
    key,
    items: pantry.map((item) => ({
      item,
      nameTokens: tokenizeIngredientName(item.name),
      idAsNameTokens: tokenizeIngredientName(item.ingredientId.replace(/-/g, ' ')),
    })),
  };
  return cachedContext;
}

export function fuzzyNameScoreWithPantryTokens(
  ingredientLabel: string,
  pantryTokens: PantryItemMatchTokens,
): number {
  return Math.max(
    fuzzyNameScore(ingredientLabel, pantryTokens.item.name),
    fuzzyNameScore(ingredientLabel, pantryTokens.item.ingredientId.replace(/-/g, ' ')),
    fuzzyNameScore(ingredientLabel.replace(/-/g, ' '), pantryTokens.item.name),
  );
}

export function ingredientMatchScoreWithPantryTokens(
  ingredientLabel: string,
  pantryTokens: PantryItemMatchTokens,
): number {
  return Math.max(
    ingredientMatchScore(ingredientLabel, pantryTokens.item.name),
    ingredientMatchScore(ingredientLabel, pantryTokens.item.ingredientId.replace(/-/g, ' ')),
  );
}

export { normalizeIngredientName };
