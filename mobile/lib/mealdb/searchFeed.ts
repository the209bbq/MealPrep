import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { mapWithConcurrency } from '../concurrency';
import { compareRecipePantryMatches, scoreRecipeAgainstPantry } from '../recipeMatch';
import type { PantryItem, Recipe } from '../../types/mealprep';
import { mealDbFilterByIngredient, mealDbLookupMeals, mealDbSearchByName } from './client';
import { mealDbMealToAppRecipe } from './normalize';
import { MEALDB } from '../../config/mealdb';

const INGREDIENT_WORD = /^[a-z][a-z0-9_-]{1,24}$/i;

function ingredientTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && INGREDIENT_WORD.test(token))
    .slice(0, 4);
}

export async function fetchMealDbSearchRows(
  query: string,
  pantry: PantryItem[],
): Promise<RecipesTabRow[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const idSet = new Set<string>();
  const nameIds = await mealDbSearchByName(trimmed);
  for (const id of nameIds) idSet.add(id);

  const tokens = ingredientTokens(trimmed);
  if (tokens.length > 0) {
    const filterResults = await mapWithConcurrency(tokens, MEALDB.maxConcurrentRequests, (token) =>
      mealDbFilterByIngredient(token),
    );
    for (const filterIds of filterResults) {
      for (const id of filterIds.slice(0, 12)) idSet.add(id);
    }
  }

  const meals = await mealDbLookupMeals([...idSet].slice(0, 24));
  const recipes: Recipe[] = meals.map((meal) => mealDbMealToAppRecipe(meal));
  const rows: RecipesTabRow[] = recipes.map((recipe) => ({
    kind: 'kitchen',
    recipe,
    match: scoreRecipeAgainstPantry(recipe, pantry),
  }));
  rows.sort((a, b) => compareRecipePantryMatches(a.match, b.match));
  return rows;
}
