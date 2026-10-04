import * as ImagePicker from 'expo-image-picker';

export type RecipeImportPickedImage = { mimeType: string; data: string };

export const RECIPE_IMPORT_CAMERA_PERMISSION_MESSAGE =
  'Camera access is needed to snap recipe pages. Enable it in Settings and try again.';

export const RECIPE_IMPORT_PHOTO_LIBRARY_PERMISSION_MESSAGE =
  'Photo library access is needed to choose recipe photos. Enable it in Settings and try again.';

/** One photo from the device camera (cookbook / recipe card scan). */
export async function pickRecipeImportPhotoFromCamera(): Promise<RecipeImportPickedImage[]> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error(RECIPE_IMPORT_CAMERA_PERMISSION_MESSAGE);
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    base64: true,
  });
  if (result.canceled || !result.assets?.[0]?.base64) return [];
  const asset = result.assets[0];
  return [
    {
      mimeType: asset.mimeType ?? 'image/jpeg',
      data: asset.base64!,
    },
  ];
}

/** Up to `max` images from the photo library (fallback / multi-page import). */
export async function pickRecipeImportPhotosFromLibrary(
  max: number,
): Promise<RecipeImportPickedImage[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(RECIPE_IMPORT_PHOTO_LIBRARY_PERMISSION_MESSAGE);
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: max,
    quality: 0.85,
    base64: true,
  });
  if (result.canceled || !result.assets?.length) return [];
  return result.assets
    .filter((asset) => asset.base64)
    .map((asset) => ({
      mimeType: asset.mimeType ?? 'image/jpeg',
      data: asset.base64!,
    }));
}
