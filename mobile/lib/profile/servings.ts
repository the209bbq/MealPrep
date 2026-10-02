import type { Recipe } from '../../types/mealprep';

/** Per-recipe override, then household default, then recipe.servings. */
export function resolveRecipeServings(
  recipe: Pick<Recipe, 'id' | 'servings'>,
  servingOverrides: Record<string, number>,
  householdSize?: number,
): number {
  const override = servingOverrides[recipe.id];
  if (override != null && override > 0) return override;
  if (householdSize != null && householdSize > 0) return householdSize;
  return recipe.servings;
}
