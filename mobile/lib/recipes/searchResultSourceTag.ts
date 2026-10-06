import { CREATOR_RECIPES_COPY } from '../../config/creatorRecipes';
import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { isUserImportedKitchenRecipe } from '../recipeImport/mapToAppRecipe';
import { isMealDbRecipeId } from '../mealdb/normalize';

export function sourceTagForRecipesTabRow(row: RecipesTabRow): string | null {
  if (row.kind !== 'kitchen') {
    return CREATOR_RECIPES_COPY.sourceClassic;
  }
  const recipe = row.recipe;
  if (isUserImportedKitchenRecipe(recipe)) {
    return 'Imported';
  }
  if (isMealDbRecipeId(recipe.id) || recipe.isMaster) {
    return CREATOR_RECIPES_COPY.sourceClassic;
  }
  return 'Saved';
}
