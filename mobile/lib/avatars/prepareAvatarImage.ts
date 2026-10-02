import * as ImageManipulator from 'expo-image-manipulator';
import { AVATARS } from '../../config/avatars';
import { computeLongEdgeResize } from '../pantryVision/prepareImageShared';
import type { PreparedAvatarImage } from './types';

async function encodeAvatar(
  uri: string,
  targetW: number,
  targetH: number,
  sourceW: number,
  sourceH: number,
  quality: number,
): Promise<ImageManipulator.ImageResult> {
  const resize =
    sourceW >= sourceH ? { resize: { width: targetW } } : { resize: { height: targetH } };
  return ImageManipulator.manipulateAsync(uri, [resize], {
    compress: quality,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
}

export async function prepareAvatarImage(uri: string): Promise<PreparedAvatarImage> {
  const oriented = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 1,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const { width: targetW, height: targetH } = computeLongEdgeResize(
    oriented.width,
    oriented.height,
    AVATARS.maxLongEdge,
  );

  let quality = AVATARS.jpegQuality;
  let manipulated = await encodeAvatar(
    oriented.uri,
    targetW,
    targetH,
    oriented.width,
    oriented.height,
    quality,
  );
  let base64 = manipulated.base64;
  if (!base64) throw new Error('Could not encode profile photo.');
  let byteLength = Math.floor((base64.length * 3) / 4);

  while (byteLength > AVATARS.maxBytes && quality > 0.45) {
    quality -= 0.08;
    manipulated = await encodeAvatar(
      oriented.uri,
      targetW,
      targetH,
      oriented.width,
      oriented.height,
      quality,
    );
    base64 = manipulated.base64;
    if (!base64) throw new Error('Could not encode profile photo.');
    byteLength = Math.floor((base64.length * 3) / 4);
  }

  if (byteLength > AVATARS.maxBytes) {
    throw new Error('Photo is still too large. Try a smaller image.');
  }

  return {
    uri: manipulated.uri,
    mimeType: 'image/jpeg',
    base64,
    byteLength,
  };
}
