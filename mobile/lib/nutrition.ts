import type { Recipe } from '../types/mealprep';

export function nutritionLabel(recipe: Pick<Recipe, 'calories' | 'protein' | 'carbs' | 'fat'>): string {
  const parts = [`${recipe.calories || 0} Cal`, `${recipe.protein || 0}g Protein`];
  if (recipe.carbs) parts.push(`${recipe.carbs}g Carbs`);
  if (recipe.fat) parts.push(`${recipe.fat}g Fat`);
  return parts.join(' · ');
}
