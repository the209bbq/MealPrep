import { resolveRecipeServings } from '../profile/servings';
import type { Recipe, RecipeIngredient } from '../../types/mealprep';

function roundQty(value: number): number {
  return Math.round(value * 100) / 100;
}

export function recipeServingScale(
  recipe: Pick<Recipe, 'id' | 'servings'>,
  servingOverrides: Record<string, number>,
  householdSize?: number,
): number {
  const servings = resolveRecipeServings(recipe, servingOverrides, householdSize);
  return recipe.servings > 0 ? servings / recipe.servings : 1;
}

export function withServingScale(
  recipe: Recipe,
  servingOverrides: Record<string, number>,
  householdSize?: number,
): Recipe {
  const scale = recipeServingScale(recipe, servingOverrides, householdSize);
  if (scale === 1) return recipe;
  return {
    ...recipe,
    ingredients: recipe.ingredients.map((ing) => ({
      ...ing,
      quantity: roundQty(ing.quantity * scale),
    })),
  };
}

export function scaleRecipeIngredients(
  ingredients: RecipeIngredient[],
  scale: number,
): RecipeIngredient[] {
  if (scale === 1) return ingredients;
  return ingredients.map((ing) => ({
    ...ing,
    quantity: roundQty(ing.quantity * scale),
  }));
}
