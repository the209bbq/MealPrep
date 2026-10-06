import type { RecipePantryMatch } from '../recipeMatch';

/** Pick a different recipe the user can cook now (missingCount === 0), if any. */
export function pickSwapPantryMatch(
  ranked: readonly RecipePantryMatch[],
  currentRecipeId: string,
): RecipePantryMatch | null {
  for (const match of ranked) {
    if (match.recipeId === currentRecipeId) continue;
    if (match.missingCount === 0 && match.totalIngredients > 0) {
      return match;
    }
  }
  return null;
}
