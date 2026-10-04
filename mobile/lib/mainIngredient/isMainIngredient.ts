import type { Recipe } from '../../types/mealprep';
import { MAIN_INGREDIENT_WEIGHT_SHARE_THRESHOLD } from '../../config/mainIngredient';
import { estimateIngredientGrams } from './estimateGrams';
import { isMinorIngredientUse } from './minorUse';
import { ingredientNameMatchesPick, recipeTitleMatchesPick } from './matchPick';
import { isPrimaryIngredientType } from './primaryKind';
import { isSubstantialMainAmount } from './substantialAmount';
import type { MainIngredientPick } from './types';

export function isMainIngredient(
  recipe: Pick<Recipe, 'name' | 'ingredients'>,
  pick: MainIngredientPick,
): boolean {
  if (recipeTitleMatchesPick(recipe.name, pick)) return true;

  const scorable = recipe.ingredients
    .map((ingredient) => {
      const minor = isMinorIngredientUse(ingredient);
      const matches = ingredientNameMatchesPick(ingredient.name, pick);
      const grams = minor ? null : estimateIngredientGrams(ingredient);
      const primary = isPrimaryIngredientType(ingredient);
      return { ingredient, minor, matches, grams, primary };
    })
    .filter((row) => !row.minor);

  const matching = scorable.filter((row) => row.matches);
  if (matching.length === 0) return false;

  const withWeight = scorable.filter((row) => row.grams != null && row.grams > 0);
  const totalGrams = withWeight.reduce((sum, row) => sum + (row.grams ?? 0), 0);

  for (const row of matching) {
    if (!row.primary) continue;
    if (!isSubstantialMainAmount(row.ingredient, row.grams)) continue;
    const grams = row.grams ?? 0;
    if (grams > 0 && totalGrams > 0) {
      const share = grams / totalGrams;
      if (share >= MAIN_INGREDIENT_WEIGHT_SHARE_THRESHOLD) return true;
    }
  }

  if (withWeight.length >= 2) {
    const ranked = [...withWeight].sort((a, b) => (b.grams ?? 0) - (a.grams ?? 0));
    const topIds = new Set(ranked.slice(0, 3).map((row) => row.ingredient.ingredientId));
    if (
      matching.some(
        (row) =>
          topIds.has(row.ingredient.ingredientId) &&
          row.primary &&
          isSubstantialMainAmount(row.ingredient, row.grams),
      )
    ) {
      return true;
    }
  }

  return matching.some(
    (row) => row.primary && isSubstantialMainAmount(row.ingredient, row.grams),
  );
}
