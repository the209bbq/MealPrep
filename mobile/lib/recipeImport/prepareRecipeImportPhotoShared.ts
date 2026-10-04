import { RECIPE_IMPORT } from '../../config/recipeImport';
import type { PreparePantryImageOptions } from '../pantryVision/prepareImageShared';

export const RECIPE_IMPORT_PHOTO_PREPARE: PreparePantryImageOptions = {
  maxLongEdge: RECIPE_IMPORT.photoUploadMaxLongEdge,
  jpegQuality: RECIPE_IMPORT.photoUploadJpegQuality,
  skipQualityCheck: true,
};
