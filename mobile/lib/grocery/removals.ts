import type { GroceryListItem } from '../../types/mealprep';
import { groceryDismissalKey, groceryPinnedLineDismissalKey } from './dismissals';

export function groceryDismissalKeysForItem(item: GroceryListItem): string[] {
  const keys = item.sourceRecipeIds.map((recipeId) =>
    groceryDismissalKey(recipeId, item.name, item.unit),
  );
  if (item.origin !== 'plan') {
    keys.push(groceryPinnedLineDismissalKey(item.name, item.unit));
  }
  return keys;
}
