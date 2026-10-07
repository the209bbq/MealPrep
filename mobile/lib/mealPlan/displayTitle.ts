import type { MealPlanItem, Recipe } from '../../types/mealprep';
import { isMealDbRecipeId } from '../mealdb/normalize';
import { mealDbRecipeId } from '../mealdb/slug';
import { parseSavedRefKey } from '../savedRecipes/keys';
import type { SavedRecipeRecord } from '../savedRecipes/types';
import { findKitchenRecipeById } from './kitchenRecipeLookup';

function titleLooksLikeStoredMealDbId(title: string, recipeSlug: string | null): boolean {
  if (!isMealDbRecipeId(title)) return false;
  if (!recipeSlug) return true;
  return title.toLowerCase() === recipeSlug.toLowerCase();
}

/** Human label for week-plan rows; repairs legacy titles that stored raw `mealdb-*` ids. */
export function resolveMealPlanItemDisplayTitle(
  item: MealPlanItem,
  feedKitchenRecipes: readonly Recipe[],
  savedRecords: readonly SavedRecipeRecord[] = [],
): string {
  if (!titleLooksLikeStoredMealDbId(item.title, item.recipeSlug)) {
    return item.title;
  }

  const slug = item.recipeSlug;
  if (slug) {
    const fromKitchen = findKitchenRecipeById([...feedKitchenRecipes], slug)?.name;
    if (fromKitchen) return fromKitchen;
  }

  for (const record of savedRecords) {
    if (slug && record.kitchenRecipeId === slug && record.title.trim()) {
      return record.title;
    }
    const parsed = parseSavedRefKey(record.refKey);
    if (parsed?.type === 'mealdb') {
      const mealdbKitchenId = mealDbRecipeId(parsed.id);
      if (slug === mealdbKitchenId) {
        if (record.title.trim()) return record.title;
        if (record.preview.kind === 'mealdb' && record.preview.shape.name.trim()) {
          return record.preview.shape.name;
        }
      }
    }
  }

  return item.title;
}
