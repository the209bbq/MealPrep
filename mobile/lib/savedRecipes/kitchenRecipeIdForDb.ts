import { isPersistedRowUuid } from '../pantry/persistIds';
import { parseSavedRefKey } from './keys';
import type { SavedRecipeRecord } from './types';

/**
 * `user_saved_recipes.kitchen_recipe_id` is a FK to `recipes.id` (uuid only).
 * Catalog slugs (`brisket`), MealDB ids (`mealdb-*`), and library rows must not be sent.
 */
export function kitchenRecipeIdForDb(
  record: SavedRecipeRecord,
  accountRecipeIds: ReadonlySet<string>,
): string | null {
  const candidate =
    record.kitchenRecipeId ?? parseSavedRefKey(record.refKey)?.id ?? null;
  if (!candidate || !isPersistedRowUuid(candidate)) return null;
  if (!accountRecipeIds.has(candidate)) return null;
  return candidate;
}
