import type { MealDbCatalogCategory } from '../../config/recipesTabSurface';
import type { UserDietPrefs } from '../diet/types';

const MEAT_CATEGORIES = new Set(['Beef', 'Chicken', 'Pork', 'Lamb', 'Goat', 'Seafood']);

export function isCategoryHiddenByDietMap(
  category: MealDbCatalogCategory,
  prefs: UserDietPrefs,
): boolean {
  const diets = prefs.diets ?? [];
  const vegetarian = diets.includes('vegetarian');
  const vegan = diets.includes('vegan');
  const pescatarian = diets.includes('pescatarian');
  const dietTokens = prefs.diets as string[];
  const halal = dietTokens.includes('halal');
  const kosher = dietTokens.includes('kosher');

  if (vegetarian || vegan) {
    if (MEAT_CATEGORIES.has(category)) return true;
  }
  if (vegan) {
    if (!['Vegetarian', 'Dessert', 'Breakfast'].includes(category)) return true;
  }
  if (pescatarian) {
    if (['Beef', 'Chicken', 'Pork', 'Lamb', 'Goat'].includes(category)) return true;
  }
  if (halal || kosher) {
    if (category === 'Pork') return true;
  }
  return false;
}

export function isCategoryHiddenByDislikes(
  category: MealDbCatalogCategory,
  prefs: UserDietPrefs,
): boolean {
  const dislikes = prefs.dislikes ?? [];
  const cat = category.toLowerCase();
  for (const dislike of dislikes) {
    const token = dislike.trim().toLowerCase();
    if (!token) continue;
    if (cat === token) return true;
    if (cat === 'beef' && token.includes('beef')) return true;
    if (cat === 'chicken' && token.includes('chicken')) return true;
    if (cat === 'pork' && token.includes('pork')) return true;
    if (cat === 'lamb' && token.includes('lamb')) return true;
    if (cat === 'goat' && token.includes('goat')) return true;
    if (cat === 'seafood' && (token.includes('seafood') || token.includes('fish') || token.includes('shellfish'))) {
      return true;
    }
  }
  return false;
}

export const MEALDB_KNOWN_CATEGORY_NAMES: readonly MealDbCatalogCategory[] = [
  'Beef',
  'Chicken',
  'Dessert',
  'Lamb',
  'Miscellaneous',
  'Pasta',
  'Pork',
  'Seafood',
  'Side',
  'Starter',
  'Vegan',
  'Vegetarian',
  'Breakfast',
  'Goat',
] as const;

const MEALDB_KNOWN_CATEGORY_LOOKUP = new Map(
  MEALDB_KNOWN_CATEGORY_NAMES.map((name) => [name.toLowerCase(), name] as const),
);

function normalizeCategoryToken(token: string): string | null {
  const hit = MEALDB_KNOWN_CATEGORY_LOOKUP.get(token.trim().toLowerCase());
  return hit ?? null;
}

export interface MealDbCategoryFromTagOptions {
  recipeId?: string | null;
  sourceType?: string | null;
}

function isMealDbSourcedRecipe(options?: MealDbCategoryFromTagOptions): boolean {
  if (options?.sourceType === 'themealdb') return true;
  const id = options?.recipeId?.trim() ?? '';
  return id.startsWith('mealdb-');
}

export function mealDbCategoryFromRecipeTag(
  tag: string | null | undefined,
  options?: MealDbCategoryFromTagOptions,
): string | null {
  if (!tag) return null;
  const parts = tag
    .split('·')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  for (const part of parts) {
    const known = normalizeCategoryToken(part);
    if (known) return known;
  }

  if (isMealDbSourcedRecipe(options)) {
    const fallback = parts[parts.length - 1] ?? parts[0];
    return fallback || null;
  }

  return null;
}
