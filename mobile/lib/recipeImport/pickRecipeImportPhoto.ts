import * as ImagePicker from 'expo-image-picker';
import { preparePantryImage } from '../pantryVision/prepareImage';
import { RECIPE_IMPORT_PHOTO_PREPARE } from './prepareRecipeImportPhotoShared';

export type RecipeImportPickedImage = { mimeType: string; data: string };

export const RECIPE_IMPORT_CAMERA_PERMISSION_MESSAGE =
  'Camera access is needed to snap recipe pages. Enable it in Settings and try again.';

export const RECIPE_IMPORT_PHOTO_LIBRARY_PERMISSION_MESSAGE =
  'Photo library access is needed to choose recipe photos. Enable it in Settings and try again.';

async function prepareFromPickerUri(uri: string): Promise<RecipeImportPickedImage> {
  const prepared = await preparePantryImage(uri, RECIPE_IMPORT_PHOTO_PREPARE);
  if (!prepared.base64) {
    throw new Error('Could not prepare photo for upload.');
  }
  return { mimeType: prepared.mimeType, data: prepared.base64 };
}

/** One photo from the device camera (cookbook / recipe card scan). */
export async function pickRecipeImportPhotoFromCamera(): Promise<RecipeImportPickedImage[]> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error(RECIPE_IMPORT_CAMERA_PERMISSION_MESSAGE);
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return [];
  return [await prepareFromPickerUri(result.assets[0].uri)];
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
    quality: 1,
  });
  if (result.canceled || !result.assets?.length) return [];
  const prepared: RecipeImportPickedImage[] = [];
  for (const asset of result.assets) {
    if (!asset.uri) continue;
    prepared.push(await prepareFromPickerUri(asset.uri));
  }
  return prepared;
}
