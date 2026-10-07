import { mealDbRecipeId } from '../mealdb/slug';
import { parseSavedRefKey } from '../savedRecipes/keys';
import type { SavedRecipeRecord } from '../savedRecipes/types';
import type { PantryMatchIndex } from '../recipeMatch';
import { resolveMealPlanRecipeId } from '../mealPlan/resolve';
import type { MealPlanItem, Recipe } from '../../types/mealprep';

export type GroceryRecipeLabelSources = {
  recipes: readonly Recipe[];
  pantryMatches?: PantryMatchIndex;
  savedRecords?: readonly SavedRecipeRecord[];
  mealPlan?: MealPlanItem[];
  mealPlanRecipes?: readonly Recipe[];
  ownerId?: string;
};

/** Resolve display titles for grocery `sourceRecipeIds` from every kitchen/saved/plan source. */
export function buildGroceryRecipeNameById(sources: GroceryRecipeLabelSources): Map<string, string> {
  const map = new Map<string, string>();

  for (const recipe of sources.recipes) {
    map.set(recipe.id, recipe.name);
  }

  if (sources.pantryMatches) {
    for (const match of sources.pantryMatches.ranked) {
      if (!map.has(match.recipeId)) {
        map.set(match.recipeId, match.recipeName);
      }
    }
    for (const [recipeId, match] of sources.pantryMatches.byRecipeId) {
      if (!map.has(recipeId)) {
        map.set(recipeId, match.recipeName);
      }
    }
  }

  for (const record of sources.savedRecords ?? []) {
    const title = record.title.trim();
    if (!title) continue;
    const parsed = parseSavedRefKey(record.refKey);
    if (parsed?.type === 'kitchen') {
      map.set(parsed.id, title);
    }
    if (parsed?.type === 'mealdb') {
      map.set(mealDbRecipeId(parsed.id), title);
    }
    if (record.kitchenRecipeId) {
      map.set(record.kitchenRecipeId, title);
    }
    if (record.mealdbId) {
      map.set(mealDbRecipeId(record.mealdbId), title);
    }
  }

  const planRecipes = sources.mealPlanRecipes ?? sources.recipes;
  const ownerId = sources.ownerId ?? '';
  for (const item of sources.mealPlan ?? []) {
    const title = item.title?.trim();
    if (!title) continue;
    const recipeId = resolveMealPlanRecipeId(item, [...planRecipes], ownerId);
    if (recipeId) {
      map.set(recipeId, title);
    }
    if (item.recipeSlug) {
      map.set(item.recipeSlug, title);
    }
  }

  return map;
}

export function groceryRecipeSourceLabels(
  sourceRecipeIds: string[],
  nameById: Map<string, string>,
): string {
  if (sourceRecipeIds.length === 0) return '';
  const labels = sourceRecipeIds
    .map((id) => resolveGroceryRecipeDisplayName(id, nameById))
    .filter((label): label is string => Boolean(label));
  return labels.join(', ');
}

function resolveGroceryRecipeDisplayName(recipeId: string, nameById: Map<string, string>): string | null {
  const name = nameById.get(recipeId);
  if (name) return name;
  if (recipeId.startsWith('mealdb-')) return null;
  return recipeId;
}
