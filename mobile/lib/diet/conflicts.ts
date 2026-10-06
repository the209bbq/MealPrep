import type { RecipeDietTagResult, UserDietPrefs } from './types';
import { LruCache } from '../recipeMatch/lruCache';
import { tagRecipe } from './tagRecipe';

const DIET_TAG_CACHE = new LruCache<string, RecipeDietTagResult>(4096);

function dietTagCacheKey(ingredientLines: readonly string[], dislikes: readonly string[]): string {
  return `${ingredientLines.join('\u0001')}\u0002${dislikes.join('\u0002')}`;
}

export function clearRecipeDietTagCacheForTests(): void {
  DIET_TAG_CACHE.clear();
}

export function recipeDietTagFromIngredientLines(
  ingredientLines: string[],
  prefs: UserDietPrefs,
): RecipeDietTagResult {
  const key = dietTagCacheKey(ingredientLines, prefs.dislikes);
  const cached = DIET_TAG_CACHE.get(key);
  if (cached) return cached;
  const result = tagRecipe({ ingredientLines, dislikes: prefs.dislikes });
  DIET_TAG_CACHE.set(key, result);
  return result;
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
