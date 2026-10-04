import { resolveImageMimeType } from '../web/inferImageMimeType';
import { pickWebImageFile } from '../web/pickWebImageFile';

export type RecipeImportPickedImage = { mimeType: string; data: string };

export const RECIPE_IMPORT_CAMERA_PERMISSION_MESSAGE =
  'Camera access is needed to snap recipe pages. Allow camera when prompted and try again.';

export const RECIPE_IMPORT_PHOTO_LIBRARY_PERMISSION_MESSAGE =
  'Could not open your photos. Try again or pick a different image.';

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not read photo'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read photo'));
    reader.readAsDataURL(file);
  });
}

async function pickOneWebImage(capture?: 'environment'): Promise<RecipeImportPickedImage[]> {
  const file = await pickWebImageFile(capture ? { capture } : undefined);
  if (!file) return [];
  try {
    const mimeType = await resolveImageMimeType(file);
    const data = await readFileAsBase64(file);
    return [{ mimeType, data }];
  } catch {
    throw new Error('Could not read that photo. Try another image.');
  }
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
