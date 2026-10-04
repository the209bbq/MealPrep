import type { RecipesTabRow } from '../../config/recipesTabFilters';
import type { Recipe } from '../../types/mealprep';

/** Normalize catalog rows to `Recipe` for cost ranking (kitchen + discovery). */
export function recipeFromRecipesTabRow(row: RecipesTabRow): Recipe {
  if (row.kind === 'kitchen') return row.recipe;
  const api = row.recipe;
  return {
    id: `discovery-${api.id}`,
    name: api.name,
    tag: api.cuisine,
    description: api.description,
    servings: api.servings,
    minutes: Math.max(1, (api.prep_time ?? 0) + (api.cook_time ?? 0)),
    calories: api.calories_per_serving,
    protein: api.protein,
    carbs: api.carbs ?? 0,
    fat: api.fat ?? 0,
    ingredients: api.ingredients.map((ing) => ({
      ingredientId: String(ing.id),
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
    })),
    steps: api.instructions,
    isMaster: false,
    createdAt: '',
  };
}
