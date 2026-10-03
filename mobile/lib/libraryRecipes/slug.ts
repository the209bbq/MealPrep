import { LIBRARY_RECIPES } from '../../config/libraryRecipes';

export function slugifyLibraryDishName(dishName: string): string {
  return dishName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

export function libraryRecipeAppId(slug: string): string {
  return `${LIBRARY_RECIPES.idPrefix}${slug}`;
}

export function isLibraryRecipeAppId(recipeId: string): boolean {
  return recipeId.startsWith(LIBRARY_RECIPES.idPrefix);
}

export function librarySlugFromAppId(recipeId: string): string | null {
  if (!isLibraryRecipeAppId(recipeId)) return null;
  const slug = recipeId.slice(LIBRARY_RECIPES.idPrefix.length);
  return slug.length > 0 ? slug : null;
}
