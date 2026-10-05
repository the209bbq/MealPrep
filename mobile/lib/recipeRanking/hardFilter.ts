import type { UserDietPrefs } from '../diet/types';
import { recipeDietTagFromIngredientLines, recipeConflictsWithDietPrefs } from '../diet/conflicts';
import type { RecipeEngagementEvent } from './types';

/** Diet/allergen/dislike exclusions for ranking (always enforced, not gated on hideConflicts). */
export function recipeFailsDietHardFilter(
  prefs: UserDietPrefs,
  ingredientLines: string[] | null,
): boolean {
  if (!ingredientLines || ingredientLines.length === 0) {
    return false;
  }
  const tag = recipeDietTagFromIngredientLines(ingredientLines, prefs);
  const strictPrefs: UserDietPrefs = { ...prefs, hideConflicts: true };
  return recipeConflictsWithDietPrefs(strictPrefs, tag, ingredientLines);
}

export function wontCookRefKeys(events: readonly RecipeEngagementEvent[]): Set<string> {
  const keys = new Set<string>();
  for (const event of events) {
    if (event.type === 'wont_cook') {
      keys.add(event.refKey);
    }
  }
  return keys;
}

export function shouldHardExcludeRecipe(
  prefs: UserDietPrefs,
  ingredientLines: string[] | null,
  refKey: string,
  events: readonly RecipeEngagementEvent[],
): boolean {
  if (wontCookRefKeys(events).has(refKey)) {
    return true;
  }
  return recipeFailsDietHardFilter(prefs, ingredientLines);
}
