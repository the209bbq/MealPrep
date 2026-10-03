import type { Recipe, RecipeIngredient } from '../../types/mealprep';
import type { LibraryRecipeRow } from './types';
import { libraryRecipeAppId } from './slug';

function mapIngredients(rows: LibraryRecipeRow['ingredients'], slug: string): RecipeIngredient[] {
  return rows.map((row, index) => ({
    ingredientId: `lib-${slug}-${index}`,
    name: row.note?.trim() ? `${row.name} (${row.note.trim()})` : row.name,
    quantity: row.quantity,
    unit: row.unit?.trim() ? row.unit.trim() : 'each',
  }));
}

/** Map a published `library_recipes` row to an in-app `Recipe` (read-only catalog). */
export function libraryRowToAppRecipe(row: LibraryRecipeRow): Recipe {
  const slug = row.slug;
  const prep = row.prep_minutes ?? 0;
  const cook = row.cook_minutes ?? 0;
  const tag = row.cuisine?.trim() || row.tags?.[0]?.trim() || 'Dinner';

  return {
    id: libraryRecipeAppId(slug),
    name: row.title.trim() || row.dish_name,
    tag,
    description: row.dish_name.trim(),
    servings: Math.max(1, row.servings),
    minutes: Math.max(1, prep + cook),
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    ingredients: mapIngredients(row.ingredients ?? [], slug),
    steps: Array.isArray(row.steps) ? row.steps.filter((s) => typeof s === 'string' && s.trim()) : [],
    isMaster: true,
    createdAt: row.created_at,
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    nutritionSource: 'MealPlanatic',
    imageUrl: row.image_url,
  };
}
