import type { PantryItem, Recipe, RecipeIngredient } from '../../types/mealprep';
import { scoreRecipeAgainstPantry, type RecipePantryMatch } from '../recipeMatch';
import type { RecipeApiRecipe, RecipeDiscoveryListItem } from './types';

function discoveryToRecipeIngredients(api: RecipeApiRecipe): RecipeIngredient[] {
  return api.ingredients.map((ing) => ({
    ingredientId: `recipeapi-ing-${ing.id}`,
    name: ing.optional ? `${ing.name} (optional)` : ing.name,
    quantity: ing.quantity,
    unit: ing.unit,
  }));
}

/** Score a RecipeAPI list/detail item against pantry without importing the recipe. */
export function scoreDiscoveryRecipeAgainstPantry(
  item: RecipeDiscoveryListItem,
  pantry: PantryItem[],
): RecipePantryMatch {
  const stub: Recipe = {
    id: `recipeapi-${item.id}`,
    name: item.name,
    tag: item.cuisine,
    description: item.description,
    servings: item.servings,
    minutes: (item.prep_time ?? 0) + (item.cook_time ?? 0),
    calories: item.calories_per_serving,
    protein: item.protein,
    carbs: item.carbs ?? 0,
    fat: item.fat ?? 0,
    ingredients: discoveryToRecipeIngredients(item),
    steps: item.instructions ?? [],
    isMaster: false,
    createdAt: new Date(0).toISOString(),
  };
  return scoreRecipeAgainstPantry(stub, pantry);
}
