import type { RecipeDietTagResult, UserDietPrefs } from './types';
import { tagRecipe } from './tagRecipe';

export function recipeDietTagFromIngredientLines(
  ingredientLines: string[],
  prefs: UserDietPrefs,
): RecipeDietTagResult {
  return tagRecipe({ ingredientLines, dislikes: prefs.dislikes });
}

export function recipeConflictsWithDietPrefs(
  prefs: UserDietPrefs,
  tag: RecipeDietTagResult,
  ingredientLines: string[],
): boolean {
  if (!prefs.hideConflicts) return false;

  const hasDietOrAllergen = prefs.diets.length > 0 || prefs.allergens.length > 0;
  const hasDislikes = prefs.dislikes.length > 0;

  if (ingredientLines.length === 0) {
    return false;
  }

  if (prefs.allergens.some((a) => tag.contains_allergens.includes(a))) {
    return true;
  }

  for (const diet of prefs.diets) {
    if (!tag.diets_ok.includes(diet)) {
      return true;
    }
  }

  if (hasDislikes && tag.dislikes_hit.length > 0) {
    return true;
  }

  if (hasDietOrAllergen && tag.unknown_items.length > 0) {
    return true;
  }

  return false;
}

export function shouldHideRecipeForDietPrefs(
  prefs: UserDietPrefs,
  ingredientLines: string[] | null,
): boolean {
  if (!ingredientLines || ingredientLines.length === 0) {
    return false;
  }
  const tag = recipeDietTagFromIngredientLines(ingredientLines, prefs);
  return recipeConflictsWithDietPrefs(prefs, tag, ingredientLines);
}
