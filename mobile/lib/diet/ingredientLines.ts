import type { RecipesTabRow } from '../../config/recipesTabFilters';
import type { Recipe } from '../../types/mealprep';
import type { RecipeDiscoveryListItem } from '../recipeDiscovery/types';
import type { CreatorFeedCardModel } from '../recipes/creatorFeedRows';

export function ingredientLinesFromRecipe(recipe: Recipe): string[] {
  return recipe.ingredients.map((ing) => ing.name).filter(Boolean);
}

export function ingredientLinesFromDiscovery(recipe: RecipeDiscoveryListItem): string[] {
  if (!recipe.ingredients?.length) return [];
  return recipe.ingredients.map((ing) => ing.name).filter(Boolean);
}

export function ingredientLinesFromRecipesTabRow(row: RecipesTabRow): string[] | null {
  if (row.kind === 'kitchen') {
    const lines = ingredientLinesFromRecipe(row.recipe);
    return lines.length > 0 ? lines : null;
  }
  const lines = ingredientLinesFromDiscovery(row.recipe);
  return lines.length > 0 ? lines : null;
}

export function ingredientLinesFromCreatorModel(model: CreatorFeedCardModel): string[] | null {
  if (!model.importedRecipe) return null;
  const lines = ingredientLinesFromRecipe(model.importedRecipe);
  return lines.length > 0 ? lines : null;
}
