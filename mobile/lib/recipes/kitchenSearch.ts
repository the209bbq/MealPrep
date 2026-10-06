import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { isUserImportedKitchenRecipe } from '../recipeImport/mapToAppRecipe';
import { scoreRecipeAgainstPantry, type PantryMatchIndex } from '../recipeMatch';
import type { Recipe } from '../../types/mealprep';
import { recipesTabRowMatchesSearch } from './unifiedFeed';

/** Local account imports matching the Recipes tab search box. */
export function searchImportedKitchenRecipes(
  query: string,
  kitchenRecipes: readonly Recipe[],
  pantryMatches: PantryMatchIndex,
): RecipesTabRow[] {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const rows: RecipesTabRow[] = [];
  for (const recipe of kitchenRecipes) {
    if (!isUserImportedKitchenRecipe(recipe)) continue;
    const row: RecipesTabRow = {
      kind: 'kitchen',
      recipe,
      match: pantryMatches.byRecipeId.get(recipe.id) ?? scoreRecipeAgainstPantry(recipe, []),
    };
    if (recipesTabRowMatchesSearch(row, trimmed)) {
      rows.push(row);
    }
  }
  rows.sort((a, b) => a.recipe.name.localeCompare(b.recipe.name));
  return rows;
}
