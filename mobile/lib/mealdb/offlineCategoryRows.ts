import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { compareRecipePantryMatches, scoreRecipeAgainstPantry } from '../recipeMatch';
import type { PantryItem } from '../../types/mealprep';
import { readCachedMealDbAppRecipe } from './client';

/** Offline: only rows whose MealDB lookup is already on device (no pending stubs). */
export function kitchenCategoryRowsAvailableOffline(
  rows: readonly RecipesTabRow[],
  pantry: PantryItem[],
): RecipesTabRow[] {
  const resolved: RecipesTabRow[] = [];
  for (const row of rows) {
    if (row.kind !== 'kitchen') continue;
    if (!row.pantryMatchPending) {
      resolved.push(row);
      continue;
    }
    const recipe = readCachedMealDbAppRecipe(row.recipe.id);
    if (!recipe) continue;
    resolved.push({
      kind: 'kitchen',
      recipe,
      match: scoreRecipeAgainstPantry(recipe, pantry),
      pantryMatchPending: false,
    });
  }
  resolved.sort((a, b) => compareRecipePantryMatches(a.match, b.match));
  return resolved;
}
