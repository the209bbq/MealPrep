import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { compareRecipePantryMatches, scoreRecipeAgainstPantry } from '../recipeMatch';
import type { PantryItem, Recipe } from '../../types/mealprep';
import { mealDbLookupMeals, mealDbSearchByName } from './client';
import { mealDbMealToAppRecipe } from './normalize';

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

  for (const token of ingredientTokens(trimmed)) {
    const { mealDbFilterByIngredient } = await import('./client');
    const filterIds = await mealDbFilterByIngredient(token);
    for (const id of filterIds.slice(0, 12)) idSet.add(id);
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
