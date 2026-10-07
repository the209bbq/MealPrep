import { isUnpriceableIngredient } from '../costPerServing/unpriceable';
import type { RecipeIngredient } from '../../types/mealprep';

/** Skip deduction when the recipe line has no measurable amount or vague unit. */
export function isIngredientUnmeasurableForDeduction(ingredient: RecipeIngredient): boolean {
  if (!Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0) return true;
  const unit = ingredient.unit?.trim() ?? '';
  if (!unit) return true;
  return isUnpriceableIngredient(ingredient.name, ingredient.quantity, unit);
}
