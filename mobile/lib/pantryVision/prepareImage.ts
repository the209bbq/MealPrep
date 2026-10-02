import * as ImageManipulator from 'expo-image-manipulator';
import { PHOTO_SCAN } from '../../config/appConfig';
import { evaluateJpegBase64Quality } from './imageQuality';
import {
  computeLongEdgeResize,
  PantryImageQualityError,
} from './prepareImageShared';
import type { PreparedPantryImage } from './types';

async function encodeWithQuality(
  uri: string,
  targetW: number,
  targetH: number,
  sourceW: number,
  sourceH: number,
  quality: number,
): Promise<ImageManipulator.ImageResult> {
  const resize =
    sourceW >= sourceH ? { resize: { width: targetW } } : { resize: { height: targetH } };
  return ImageManipulator.manipulateAsync(
    uri,
    [resize],
    {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );
}

export async function preparePantryImage(uri: string): Promise<PreparedPantryImage> {
  const oriented = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 1,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const { width: targetW, height: targetH } = computeLongEdgeResize(
    oriented.width,
    oriented.height,
    PHOTO_SCAN.maxImageDimension,
  );

  let quality = PHOTO_SCAN.jpegQuality;
  let manipulated = await encodeWithQuality(
    oriented.uri,
    targetW,
    targetH,
    oriented.width,
    oriented.height,
    quality,
  );
  let base64 = manipulated.base64;
  if (!base64) {
    throw new Error('Could not encode image for upload.');
  }
  let byteLength = Math.floor((base64.length * 3) / 4);

  while (byteLength > PHOTO_SCAN.maxPayloadBytes && quality > 0.42) {
    quality -= 0.06;
    manipulated = await encodeWithQuality(
      oriented.uri,
      targetW,
      targetH,
      oriented.width,
      oriented.height,
      quality,
    );
    base64 = manipulated.base64;
    if (!base64) throw new Error('Could not encode image for upload.');
    byteLength = Math.floor((base64.length * 3) / 4);
  }

  if (byteLength > PHOTO_SCAN.maxPayloadBytes) {
    throw new Error('Photo is still too large after resizing. Try a closer crop.');
  }

  const thumb = await ImageManipulator.manipulateAsync(
    manipulated.uri,
    [{ resize: { width: 128 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  let qualityWarnings: string[] | undefined;
  if (thumb.base64) {
    const evaluation = await evaluateJpegBase64Quality(thumb.base64);
    if (evaluation.hardReject === 'blank') {
      throw new PantryImageQualityError('blank', evaluation.hardRejectMessage ?? PHOTO_SCAN.imageBlankMessage);
    }
    if (evaluation.warnings.length > 0) {
      qualityWarnings = evaluation.warnings;
    }
  }

  return {
    uri: manipulated.uri,
    mimeType: 'image/jpeg',
    base64,
    byteLength,
    contentHash: undefined,
    qualityWarnings,
  };
}
