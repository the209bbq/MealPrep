import { shouldHideRecipeForDietPrefs } from '../diet/conflicts';
import type { UserDietPrefs } from '../diet/types';
import type { StapleCatalogEntry } from './stapleCatalog';

/** Hide staple picks that conflict with the user's diet or allergen settings. */
export function filterStaplesForDietPrefs(
  staples: readonly StapleCatalogEntry[],
  prefs: UserDietPrefs,
): StapleCatalogEntry[] {
  if (!prefs.hideConflicts) return [...staples];
  return staples.filter(
    (staple) => !shouldHideRecipeForDietPrefs(prefs, [staple.name]),
  );
}
