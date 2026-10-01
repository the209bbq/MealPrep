import type { GroceryListItem } from '../../types/mealprep';
import { groceryDismissalKey } from './dismissals';

export function groceryDismissalKeysForItem(item: GroceryListItem): string[] {
  if (item.sourceRecipeIds.length === 0) return [];
  return item.sourceRecipeIds.map((recipeId) => groceryDismissalKey(recipeId, item.name, item.unit));
}
