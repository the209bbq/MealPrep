import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { dietCheckLinesFromRecipesTabRow } from '../diet/ingredientLines';
import { shouldHideRecipeForDietPrefs } from '../diet/conflicts';
import type { UserDietPrefs } from '../diet/types';
import { scoreRecipeAgainstPantry } from '../recipeMatch';
import type { PantryItem } from '../../types/mealprep';
import { mealDbLookupMeal } from './client';
import { mealDbMealToAppRecipe } from './normalize';
import { mealDbIdFromRecipeId } from './slug';

export async function resolveKitchenRecipesTabRowDetails(
  row: RecipesTabRow,
  pantry: PantryItem[],
): Promise<RecipesTabRow | null> {
  if (row.kind !== 'kitchen') return row;
  if (!row.pantryMatchPending) return row;

  const idMeal = mealDbIdFromRecipeId(row.recipe.id);
  if (!idMeal) return null;

  const meal = await mealDbLookupMeal(idMeal);
  if (!meal) return null;

  const recipe = mealDbMealToAppRecipe(meal);
  return {
    kind: 'kitchen',
    recipe,
    match: scoreRecipeAgainstPantry(recipe, pantry),
    pantryMatchPending: false,
  };
}

export function kitchenRowFailsDietPrefs(row: RecipesTabRow, prefs: UserDietPrefs): boolean {
  const lines = dietCheckLinesFromRecipesTabRow(row);
  return shouldHideRecipeForDietPrefs(prefs, lines);
}
