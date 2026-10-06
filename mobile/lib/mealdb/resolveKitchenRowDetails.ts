import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { dietCheckLinesFromRecipesTabRow } from '../diet/ingredientLines';
import { shouldHideRecipeForDietPrefs } from '../diet/conflicts';
import type { UserDietPrefs } from '../diet/types';
import { scoreRecipeAgainstPantry } from '../recipeMatch';
import type { PantryItem } from '../../types/mealprep';
import { isOffline } from '../network/isOffline';
import { mealDbLookupMeal, readCachedMealDbAppRecipe } from './client';
import { mealDbMealToAppRecipe } from './normalize';
import { mealDbIdFromRecipeId } from './slug';

export async function resolveKitchenRecipesTabRowDetails(
  row: RecipesTabRow,
  pantry: PantryItem[],
): Promise<RecipesTabRow | null> {
  if (row.kind !== 'kitchen') return row;
  if (!row.pantryMatchPending && !row.pantryMatchFailed) return row;

  const idMeal = mealDbIdFromRecipeId(row.recipe.id);
  if (!idMeal) return null;

  if (isOffline()) {
    const cached = readCachedMealDbAppRecipe(row.recipe.id);
    if (!cached) return null;
    return {
      kind: 'kitchen',
      recipe: cached,
      match: scoreRecipeAgainstPantry(cached, pantry),
      pantryMatchPending: false,
      pantryMatchFailed: false,
    };
  }

  const meal = await mealDbLookupMeal(idMeal, { priority: 'user-visible' });
  if (!meal) return null;

  const recipe = mealDbMealToAppRecipe(meal);
  return {
    kind: 'kitchen',
    recipe,
    match: scoreRecipeAgainstPantry(recipe, pantry),
    pantryMatchPending: false,
    pantryMatchFailed: false,
  };
}

export function kitchenRowFailsDietPrefs(row: RecipesTabRow, prefs: UserDietPrefs): boolean {
  const lines = dietCheckLinesFromRecipesTabRow(row);
  return shouldHideRecipeForDietPrefs(prefs, lines);
}
