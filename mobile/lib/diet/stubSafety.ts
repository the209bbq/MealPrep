import type { UserDietPrefs } from './types';

/** Allergen + hide-conflicts users must not see MealDB stub titles before full lookup. */
export function userNeedsResolvedMealDbRowsBeforeDisplay(prefs: UserDietPrefs): boolean {
  return prefs.hideConflicts && prefs.allergens.length > 0;
}
