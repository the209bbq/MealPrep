import { PHOTO_SCAN } from '../../config/appConfig';
import {
  inferImageMimeType,
  isHeicMimeType,
  resolveImageMimeType,
} from '../web/inferImageMimeType';
import {
  computeDetailTiles,
  computeLongEdgeResize,
  evaluateImageQuality,
  PantryImageQualityError,
  type PreparePantryImageOptions,
} from './prepareImageShared';
import type { PreparedPantryImage, PreparedPantryImageTile } from './types';

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });
}

async function blobToImageBitmap(blob: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      return await createImageBitmap(blob);
    }
  }
  const dataUrl = await readFileAsDataUrl(blob);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not load image'));
    el.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.drawImage(img, 0, 0);
  return createImageBitmap(canvas);
}

async function heicBlobToJpegBlob(file: File): Promise<Blob> {
  const { default: heic2any } = await import('heic2any');
  const converted = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.92,
  });
  return Array.isArray(converted) ? converted[0]! : converted;
}

/** Decode camera-roll HEIC/HEIF when the browser cannot paint them directly. */
async function fileToDecodableBlob(file: File, mimeType: string): Promise<Blob> {
  if (isHeicMimeType(mimeType)) {
    try {
      return await heicBlobToJpegBlob(file);
    } catch {
      /* fall through — try native decode (Safari) */
    }
  }
  if (!file.type || file.type === 'application/octet-stream' || file.type === 'image/*') {
    return new Blob([file], { type: mimeType });
  }
  return file;
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  const mimeType = await resolveImageMimeType(file);
  const decodable = await fileToDecodableBlob(file, mimeType);
  try {
    return await blobToImageBitmap(decodable);
  } catch {
    if (isHeicMimeType(mimeType)) {
      throw new Error('Could not load HEIC photo. Try JPG or PNG, or turn off HEIC in camera settings.');
    }
    throw new Error('Could not load image. Try JPG or PNG.');
  }
}

function canvasToJpegBase64(canvas: HTMLCanvasElement, quality: number): string {
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const base64 = dataUrl.split(',')[1] ?? '';
  if (!base64) {
    throw new Error('Could not encode image for upload.');
  }
  return base64;
}

/**
 * Zoomed crops cut from the original bitmap (not from the already-shrunk main image).
 * Best effort: a crop that cannot be drawn or will not fit is left out, and the scan goes
 * ahead with the main image alone.
 */
function encodeDetailTiles(bitmap: ImageBitmap): PreparedPantryImageTile[] {
  const settings = PHOTO_SCAN.detailTiles;
  const tiles: PreparedPantryImageTile[] = [];
  try {
    for (const rect of computeDetailTiles(bitmap.width, bitmap.height)) {
      const canvas = document.createElement('canvas');
      canvas.width = rect.targetWidth;
      canvas.height = rect.targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return [];
      ctx.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.targetWidth, rect.targetHeight);

      let quality: number = settings.jpegQuality;
      let base64 = canvasToJpegBase64(canvas, quality);
      let byteLength = Math.floor((base64.length * 3) / 4);
      while (byteLength > settings.maxTileBytes && quality > 0.5) {
        quality -= 0.08;
        base64 = canvasToJpegBase64(canvas, quality);
        byteLength = Math.floor((base64.length * 3) / 4);
      }
      canvas.width = 0;
      canvas.height = 0;
      if (byteLength > settings.maxTileBytes) continue;
      tiles.push({ mimeType: 'image/jpeg', base64, byteLength, position: rect.position });
    }
  } catch {
    return [];
  }
  return tiles;
}

function evaluateCanvasQuality(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return evaluateImageQuality(new Float32Array([0.5]), 1, 1);
  }
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  const luma = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    luma[p] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
  }
  return evaluateImageQuality(luma, width, height);
}

export async function preparePantryImageFromFile(
  file: File,
  options?: PreparePantryImageOptions,
): Promise<PreparedPantryImage> {
  if (file.size <= 0) {
    throw new Error('That photo file looks empty. Try picking it again.');
  }

  const maxLongEdge = options?.maxLongEdge ?? PHOTO_SCAN.maxImageDimension;
  const maxPayloadBytes = options?.maxPayloadBytes ?? PHOTO_SCAN.maxPayloadBytes;
  const skipQualityCheck = options?.skipQualityCheck ?? false;

  const bitmap = await loadBitmap(file);
  const { width: targetW, height: targetH } = computeLongEdgeResize(
    bitmap.width,
    bitmap.height,
    maxLongEdge,
  );

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  const wantsTiles = (options?.detailTiles ?? false) && PHOTO_SCAN.detailTiles.enabled;
  const detailTiles = wantsTiles ? encodeDetailTiles(bitmap) : [];
  bitmap.close?.();

  let qualityWarnings: string[] | undefined;
  if (!skipQualityCheck) {
    const qualityAssessment = evaluateCanvasQuality(canvas);
    if (qualityAssessment.hardReject === 'blank') {
      throw new PantryImageQualityError('blank', qualityAssessment.hardRejectMessage ?? PHOTO_SCAN.imageBlankMessage);
    }
    qualityWarnings =
      qualityAssessment.warnings.length > 0 ? qualityAssessment.warnings : undefined;
  }

  let quality = options?.jpegQuality ?? PHOTO_SCAN.jpegQuality;
  let base64 = canvasToJpegBase64(canvas, quality);
  let byteLength = Math.floor((base64.length * 3) / 4);

  while (byteLength > maxPayloadBytes && quality > 0.42) {
    quality -= 0.06;
    base64 = canvasToJpegBase64(canvas, quality);
    byteLength = Math.floor((base64.length * 3) / 4);
  }

  if (byteLength > maxPayloadBytes) {
    throw new Error('Photo is still too large after resizing. Try a closer crop.');
  }

  const previewBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode preview image'))),
      'image/jpeg',
      quality,
    );
  });

  return {
    uri: URL.createObjectURL(previewBlob),
    mimeType: 'image/jpeg',
    base64,
    byteLength,
    contentHash: undefined,
    qualityWarnings,
    detailTiles: detailTiles.length > 0 ? detailTiles : undefined,
  };
}

/** Resize an object URL / data URL (from image picker on web). */
export async function preparePantryImage(
  uri: string,
  options?: PreparePantryImageOptions,
): Promise<PreparedPantryImage> {
  let blob: Blob;
  try {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error('Could not read image URL');
    }
    blob = await response.blob();
  } catch {
    throw new Error('Could not read image from picker. Try choosing the photo again.');
  }

  const mimeType = blob.type ? inferImageMimeType({ name: 'photo.jpg', type: blob.type }) : 'image/jpeg';
  const file = new File([blob], 'pantry.jpg', { type: mimeType });
  return preparePantryImageFromFile(file, options);
}
