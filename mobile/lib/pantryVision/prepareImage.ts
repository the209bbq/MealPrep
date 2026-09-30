import * as ImageManipulator from 'expo-image-manipulator';
import { PHOTO_SCAN } from '../../config/appConfig';
import type { PreparedPantryImage } from './types';

export async function preparePantryImage(uri: string): Promise<PreparedPantryImage> {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: PHOTO_SCAN.maxImageDimension } }],
    {
      compress: PHOTO_SCAN.jpegQuality,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );

  const base64 = manipulated.base64;
  if (!base64) {
    throw new Error('Could not encode image for upload.');
  }
  const byteLength = Math.floor((base64.length * 3) / 4);

  if (byteLength > PHOTO_SCAN.maxPayloadBytes) {
    throw new Error('Photo is still too large after resizing. Try a closer crop.');
  }

  return {
    uri: manipulated.uri,
    mimeType: 'image/jpeg',
    base64,
    byteLength,
  };
}
