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

export function mealDbCategoryFromRecipeTag(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const parts = tag.split('·').map((part) => part.trim());
  const candidate = parts[parts.length - 1] ?? parts[0];
  return candidate || null;
}
