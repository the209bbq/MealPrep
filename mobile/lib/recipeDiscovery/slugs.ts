import type { Recipe } from '../../types/mealprep';

/** Shared kitchen catalog slug for a RecipeAPI.io recipe (admin import). */
export function recipeApiMasterSlug(apiId: number): string {
  return `recipeapi-${apiId}`;
}

/** Per-user slug so personal imports never collide with masters or other members. */
export function recipeApiPersonalSlug(apiId: number, userId: string): string {
  return `recipeapi-${apiId}--${userId}`;
}

export function parseRecipeApiNumericId(slug: string): number | null {
  const match = slug.match(/^recipeapi-(\d+)(?:--[0-9a-f-]{36})?$/i);
  if (!match) return null;
  const id = Number.parseInt(match[1], 10);
  return Number.isFinite(id) ? id : null;
}

export function isRecipeApiInLibrary(recipes: Recipe[], apiId: number, userId: string): boolean {
  const master = recipeApiMasterSlug(apiId);
  const personal = recipeApiPersonalSlug(apiId, userId);
  return recipes.some((r) => r.id === master || r.id === personal);
}
