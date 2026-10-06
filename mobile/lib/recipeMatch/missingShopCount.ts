import type { RecipeIngredient } from '../../types/mealprep';
import type { RecipePantryMatch } from './match';

/** Canonical missing-ingredient count for cards, Cook now, and grocery copy. */
export function recipeMissingShopCount(match: RecipePantryMatch | null | undefined): number {
  if (!match) return 0;
  return match.missing.length;
}

export function recipeMissingShopCountFromIngredients(missing: readonly RecipeIngredient[]): number {
  return missing.length;
}
