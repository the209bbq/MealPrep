import { preparePantryImageFromFile } from '../pantryVision/prepareImage.web';
import { pickWebImageFile } from '../web/pickWebImageFile';
import { RECIPE_IMPORT_PHOTO_PREPARE } from './prepareRecipeImportPhotoShared';

export type RecipeImportPickedImage = { mimeType: string; data: string };

export const RECIPE_IMPORT_CAMERA_PERMISSION_MESSAGE =
  'Camera access is needed to snap recipe pages. Allow camera when prompted and try again.';

export const RECIPE_IMPORT_PHOTO_LIBRARY_PERMISSION_MESSAGE =
  'Could not open your photos. Try again or pick a different image.';

async function prepareFromWebFile(file: File): Promise<RecipeImportPickedImage> {
  try {
    const prepared = await preparePantryImageFromFile(file, RECIPE_IMPORT_PHOTO_PREPARE);
    if (!prepared.base64) {
      throw new Error('Could not prepare photo for upload.');
    }
    return { mimeType: prepared.mimeType, data: prepared.base64 };
  } catch {
    throw new Error('Could not read that photo. Try another image.');
  }
}

async function pickOneWebImage(capture?: 'environment'): Promise<RecipeImportPickedImage[]> {
  const file = await pickWebImageFile(capture ? { capture } : undefined);
  if (!file) return [];
  return [await prepareFromWebFile(file)];
}

/** Opens the system picker (camera or gallery on mobile web). */
export async function pickRecipeImportPhotoFromCamera(): Promise<RecipeImportPickedImage[]> {
  return pickOneWebImage('environment');
}

export async function pickRecipeImportPhotosFromLibrary(
  _max: number,
): Promise<RecipeImportPickedImage[]> {
  return pickOneWebImage();
}
