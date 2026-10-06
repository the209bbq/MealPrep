import type { RecipesTabRow } from '../../config/recipesTabFilters';
import type { CreatorFeedCardModel } from '../recipes/creatorFeedRows';
import type { RecipesSearchResultItem } from '../recipes/mergeSearchResults';
import type { RecipePantryMatch } from '../recipeMatch';
import { shouldHideRecipeForDietPrefs } from './conflicts';
import { shouldHideCreatorModelForDietPrefs } from './creatorAllergenCheck';
import { dietCheckLinesFromRecipesTabRow } from './ingredientLines';
import type { UserDietPrefs } from './types';
import { userNeedsResolvedMealDbRowsBeforeDisplay } from './stubSafety';

export function filterRecipesTabRowsForDietPrefs(
  rows: readonly RecipesTabRow[],
  prefs: UserDietPrefs,
): RecipesTabRow[] {
  if (!prefs.hideConflicts) return [...rows];
  return rows.filter((row) => {
    if (
      userNeedsResolvedMealDbRowsBeforeDisplay(prefs) &&
      row.kind === 'kitchen' &&
      row.pantryMatchPending
    ) {
      return true;
    }
    const lines = dietCheckLinesFromRecipesTabRow(row);
    return !shouldHideRecipeForDietPrefs(prefs, lines);
  });
}

export function filterCreatorFeedModelsForDietPrefs(
  models: readonly CreatorFeedCardModel[],
  prefs: UserDietPrefs,
): CreatorFeedCardModel[] {
  if (!prefs.hideConflicts) return [...models];
  return models.filter((model) => !shouldHideCreatorModelForDietPrefs(prefs, model));
}

export function filterRecipeSearchResultsForDietPrefs(
  items: readonly RecipesSearchResultItem[],
  prefs: UserDietPrefs,
): RecipesSearchResultItem[] {
  if (!prefs.hideConflicts) return [...items];
  return items.filter((item) => {
    if (item.kind === 'classic') {
      const lines = dietCheckLinesFromRecipesTabRow(item.row);
      return !shouldHideRecipeForDietPrefs(prefs, lines);
    }
    return !shouldHideCreatorModelForDietPrefs(prefs, item.model);
  });
}

export function filterPantryMatchesForDietPrefs(
  matches: readonly RecipePantryMatch[],
  prefs: UserDietPrefs,
  recipeIngredientsById: ReadonlyMap<string, string[]>,
): RecipePantryMatch[] {
  if (!prefs.hideConflicts) return [...matches];
  return matches.filter((match) => {
    const lines = recipeIngredientsById.get(match.recipeId) ?? [];
    const checkLines = lines.length > 0 ? lines : [match.recipeName];
    return !shouldHideRecipeForDietPrefs(prefs, checkLines);
  });
}
