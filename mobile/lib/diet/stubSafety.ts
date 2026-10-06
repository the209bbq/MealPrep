import type { UserDietPrefs } from './types';

/** Allergen/dislike + hide-conflicts users must not see MealDB stub titles before full lookup. */
export function userNeedsResolvedMealDbRowsBeforeDisplay(prefs: UserDietPrefs): boolean {
  if (!prefs.hideConflicts) return false;
  return prefs.allergens.length > 0 || prefs.dislikes.length > 0;
}
