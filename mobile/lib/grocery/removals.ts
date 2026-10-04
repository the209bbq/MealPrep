import type { GroceryListItem, Recipe } from '../../types/mealprep';
import { normalizeIngredientName } from '../recipeMatch/normalize';
import {
  groceryDismissalKey,
  groceryManualLineDismissalKey,
} from './dismissals';

export interface GroceryDismissalContext {
  plannedRecipeIds: readonly string[];
  recipes: readonly Recipe[];
}

function ingredientUnitKey(name: string, unit: string): string {
  return `${normalizeIngredientName(name)}::${unit.trim().toLowerCase()}`;
}

function inferRecipeDismissalKeysFromPlan(
  item: Pick<GroceryListItem, 'name' | 'unit'>,
  ctx: GroceryDismissalContext,
): string[] {
  const targetKey = ingredientUnitKey(item.name, item.unit);
  const keys: string[] = [];
  for (const recipe of ctx.recipes) {
    if (!ctx.plannedRecipeIds.includes(recipe.id)) continue;
    for (const ingredient of recipe.ingredients) {
      if (ingredientUnitKey(ingredient.name, ingredient.unit) !== targetKey) continue;
      keys.push(groceryDismissalKey(recipe.id, item.name, item.unit));
    }
  }
  return keys;
}

export function groceryDismissalKeysForItem(
  item: GroceryListItem,
  ctx?: GroceryDismissalContext,
): string[] {
  const recipeKeys =
    item.sourceRecipeIds.length > 0
      ? item.sourceRecipeIds.map((recipeId) => groceryDismissalKey(recipeId, item.name, item.unit))
      : ctx
        ? inferRecipeDismissalKeysFromPlan(item, ctx)
        : [];

  if (recipeKeys.length > 0) return recipeKeys;
  return [groceryManualLineDismissalKey(item.name, item.unit)];
}
