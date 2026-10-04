export function mealDbRecipeId(idMeal: string): string {
  return `mealdb-${idMeal.trim()}`;
}

export function mealDbIdFromRecipeId(recipeId: string): string | null {
  if (!recipeId.startsWith('mealdb-')) return null;
  return recipeId.slice('mealdb-'.length) || null;
}
