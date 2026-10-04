export function savedRefKeyKitchen(recipeId: string): string {
  return `kitchen:${recipeId}`;
}

export function savedRefKeyCreator(videoId: string): string {
  return `creator:${videoId.trim()}`;
}

export function savedRefKeyMealDb(idMeal: string): string {
  return `mealdb:${idMeal.trim()}`;
}

export function parseSavedRefKey(refKey: string): { type: 'kitchen' | 'creator' | 'mealdb'; id: string } | null {
  const [prefix, ...rest] = refKey.split(':');
  const id = rest.join(':');
  if (!id) return null;
  if (prefix === 'kitchen') return { type: 'kitchen', id };
  if (prefix === 'creator') return { type: 'creator', id };
  if (prefix === 'mealdb') return { type: 'mealdb', id };
  return null;
}
