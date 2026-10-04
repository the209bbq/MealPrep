import { MEALDB } from '../../config/mealdb';
import { compareRecipePantryMatches, scoreRecipeAgainstPantry } from '../recipeMatch';
import type { PantryItem, Recipe } from '../../types/mealprep';
import type { RecipesTabRow } from '../../config/recipesTabFilters';
import {
  mealDbFilterByIngredient,
  mealDbLookupMeals,
  mealDbRandomMeal,
  mealDbSearchByName,
} from './client';
import { mealDbMealToAppRecipe } from './normalize';
import { mealDbPantryProteinFilters } from './pantryProteins';

export interface MealDbCatalogResult {
  rows: RecipesTabRow[];
  errorMessage: string | null;
}

async function collectMealIdsForPantry(pantry: PantryItem[]): Promise<string[]> {
  const filters = mealDbPantryProteinFilters(pantry, MEALDB.maxPantryFilterQueries);
  const idSets: string[][] = [];
  if (filters.length > 0) {
    for (const filter of filters) {
      idSets.push(await mealDbFilterByIngredient(filter));
    }
  } else {
    const random = await mealDbRandomMeal();
    if (random) return [random.idMeal];
    const browse = await mealDbSearchByName('chicken');
    return browse;
  }
  const counts = new Map<string, number>();
  for (const ids of idSets) {
    for (const id of ids) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, MEALDB.maxCatalogMeals);
}

export async function fetchMealDbCatalogRows(pantry: PantryItem[]): Promise<MealDbCatalogResult> {
  try {
    const ids = await collectMealIdsForPantry(pantry);
    const capped = ids.slice(0, MEALDB.maxCatalogMeals);
    const meals = await mealDbLookupMeals(capped);
    const recipes: Recipe[] = meals.map((meal) => mealDbMealToAppRecipe(meal));
    const rows: RecipesTabRow[] = recipes.map((recipe) => {
      const match = scoreRecipeAgainstPantry(recipe, pantry);
      return { kind: 'kitchen', recipe, match };
    });
    rows.sort((a, b) => compareRecipePantryMatches(a.match, b.match));
    return { rows, errorMessage: rows.length === 0 ? null : null };
  } catch {
    return { rows: [], errorMessage: 'Could not load classic recipes right now.' };
  }
}

export function mealDbRowsFromRecipes(
  recipes: Recipe[],
  pantry: PantryItem[],
): RecipesTabRow[] {
  const rows = recipes.map((recipe) => ({
    kind: 'kitchen' as const,
    recipe,
    match: scoreRecipeAgainstPantry(recipe, pantry),
  }));
  rows.sort((a, b) => compareRecipePantryMatches(a.match, b.match));
  return rows;
}
