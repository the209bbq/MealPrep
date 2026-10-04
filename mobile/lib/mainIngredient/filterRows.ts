import type { RecipesTabRow } from '../../config/recipesTabFilters';
import type { CreatorFeedCardModel } from '../recipes/creatorFeedRows';
import type { Recipe } from '../../types/mealprep';
import type { RecipePantryMatch } from '../recipeMatch';
import { isMainIngredient } from './isMainIngredient';
import type { MainIngredientPick } from './types';

export function recipeMatchesMainIngredientPick(recipe: Recipe, pick: MainIngredientPick): boolean {
  return isMainIngredient(recipe, pick);
}

export function recipesTabRowMatchesMainPick(row: RecipesTabRow, pick: MainIngredientPick): boolean {
  if (row.kind === 'kitchen') {
    return recipeMatchesMainIngredientPick(row.recipe, pick);
  }
  const discoveryRecipe = {
    name: row.recipe.name,
    ingredients: row.recipe.ingredients.map((ing) => ({
      ingredientId: String(ing.id),
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
    })),
  };
  return isMainIngredient(discoveryRecipe, pick);
}

export function creatorFeedModelMatchesMainPick(
  model: CreatorFeedCardModel,
  pick: MainIngredientPick,
): boolean {
  if (model.importedRecipe) {
    return recipeMatchesMainIngredientPick(model.importedRecipe, pick);
  }
  return isMainIngredient({ name: model.item.title, ingredients: [] }, pick);
}

export function zeroMatchForUnknownRecipe(recipeId: string, recipeName: string): RecipePantryMatch {
  return {
    recipeId,
    recipeName,
    totalIngredients: 0,
    matchedCount: 0,
    missingCount: 0,
    percentMatch: 0,
    matched: [],
    missing: [],
  };
}
