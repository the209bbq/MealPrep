/**
 * Single normalization path: shared catalog/import shape → app `Recipe` for pantry match & grocery flows.
 */
export { mapExtractedImportToRecipe as normalizeImportedExtractToRecipe } from '../recipeImport/mapToAppRecipe';
export {
  mapNormalizedRecipeToAppRecipe,
  splitRecipeInstructionText,
  type NormalizedRecipeShape,
} from './normalizedRecipeShape';
export { mealDbMealToAppRecipe, mealDbMealToNormalizedShape } from '../mealdb/normalize';
