import { recipeApiMasterSlug, recipeApiPersonalSlug } from '../recipeDiscovery/slugs';
import type { MealPlanItem, Recipe } from '../../types/mealprep';

/** Recipe id used for grocery aggregation and pantry match index. */
export function resolveMealPlanRecipeId(
  item: MealPlanItem,
  recipes: Recipe[],
  userId: string,
): string | null {
  if (item.recipeSlug) {
    if (recipes.some((r) => r.id === item.recipeSlug)) return item.recipeSlug;
  }
  if (item.recipeApiId != null) {
    const master = recipeApiMasterSlug(item.recipeApiId);
    const personal = recipeApiPersonalSlug(item.recipeApiId, userId);
    const hit = recipes.find((r) => r.id === master || r.id === personal);
    if (hit) return hit.id;
    return personal;
  }
  return item.recipeSlug;
}

export function activeMealPlanRecipeIds(
  mealPlan: MealPlanItem[],
  recipes: Recipe[],
  userId: string,
): string[] {
  const ids: string[] = [];
  for (const item of mealPlan) {
    if (item.made) continue;
    const id = resolveMealPlanRecipeId(item, recipes, userId);
    if (id) ids.push(id);
  }
  return ids;
}

export function isRecipeOnMealPlan(
  mealPlan: MealPlanItem[],
  options: { recipeSlug?: string; recipeApiId?: number },
): MealPlanItem | undefined {
  return mealPlan.find((item) => {
    if (item.made) return false;
    if (item.scheduledOn) return false;
    if (options.recipeSlug && item.recipeSlug === options.recipeSlug) return true;
    if (options.recipeApiId != null && item.recipeApiId === options.recipeApiId) return true;
    return false;
  });
}
