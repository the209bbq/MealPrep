/**
 * Single normalization path: recipe-import DTO → app `Recipe` for pantry match & grocery flows.
 */
export { mapExtractedImportToRecipe as normalizeImportedExtractToRecipe } from '../recipeImport/mapToAppRecipe';
