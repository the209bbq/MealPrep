import * as ImageManipulator from 'expo-image-manipulator';
import { PHOTO_SCAN } from '../../config/appConfig';
import { evaluateJpegBase64Quality } from './imageQuality';
import {
  computeLongEdgeResize,
  PantryImageQualityError,
  type PreparePantryImageOptions,
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

export async function preparePantryImage(
  uri: string,
  options?: PreparePantryImageOptions,
): Promise<PreparedPantryImage> {
  const maxLongEdge = options?.maxLongEdge ?? PHOTO_SCAN.maxImageDimension;
  const maxPayloadBytes = options?.maxPayloadBytes ?? PHOTO_SCAN.maxPayloadBytes;
  const skipQualityCheck = options?.skipQualityCheck ?? false;

  const oriented = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 1,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const { width: targetW, height: targetH } = computeLongEdgeResize(
    oriented.width,
    oriented.height,
    maxLongEdge,
  );

  let quality = options?.jpegQuality ?? PHOTO_SCAN.jpegQuality;
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

  while (byteLength > maxPayloadBytes && quality > 0.42) {
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

  if (byteLength > maxPayloadBytes) {
    throw new Error('Photo is still too large after resizing. Try a closer crop.');
  }

  let qualityWarnings: string[] | undefined;
  if (!skipQualityCheck) {
    const thumb = await ImageManipulator.manipulateAsync(
      manipulated.uri,
      [{ resize: { width: 128 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (thumb.base64) {
      const evaluation = await evaluateJpegBase64Quality(thumb.base64);
      if (evaluation.hardReject === 'blank') {
        throw new PantryImageQualityError('blank', evaluation.hardRejectMessage ?? PHOTO_SCAN.imageBlankMessage);
      }
      if (evaluation.warnings.length > 0) {
        qualityWarnings = evaluation.warnings;
      }
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
