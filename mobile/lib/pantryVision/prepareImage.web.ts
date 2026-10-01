import { PHOTO_SCAN } from '../../config/appConfig';
import { inferImageMimeType, isHeicMimeType } from '../web/inferImageMimeType';
import { assessGrayscaleQuality, computeLongEdgeResize, PantryImageQualityError } from './prepareImageShared';
import type { PreparedPantryImage } from './types';

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

/** Decode camera-roll HEIC/HEIF and other formats browsers cannot paint directly. */
async function fileToDecodableBlob(file: File): Promise<Blob> {
  const mimeType = inferImageMimeType(file);
  if (isHeicMimeType(mimeType)) {
    try {
      return await heicBlobToJpegBlob(file);
    } catch {
      /* fall through — try native decode (Safari) */
    }
  }
  if (!file.type || file.type === 'application/octet-stream') {
    return new Blob([file], { type: mimeType });
  }
  return file;
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  const decodable = await fileToDecodableBlob(file);
  try {
    return await blobToImageBitmap(decodable);
  } catch {
    const mime = inferImageMimeType(file);
    if (isHeicMimeType(mime)) {
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

function assessCanvasQuality(canvas: HTMLCanvasElement): ReturnType<typeof assessGrayscaleQuality> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { ok: true, meanLuminance: 0.5, laplacianVariance: 100 };
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  const luma = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    luma[p] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
  }
  return assessGrayscaleQuality(luma, width, height);
}

export async function preparePantryImageFromFile(file: File): Promise<PreparedPantryImage> {
  if (file.size <= 0) {
    throw new Error('That photo file looks empty. Try picking it again.');
  }

  const bitmap = await loadBitmap(file);
  const { width: targetW, height: targetH } = computeLongEdgeResize(
    bitmap.width,
    bitmap.height,
    PHOTO_SCAN.maxImageDimension,
  );

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close?.();

  const qualityAssessment = assessCanvasQuality(canvas);
  if (!qualityAssessment.ok && qualityAssessment.rejectReason === 'too_dark') {
    throw new PantryImageQualityError('too_dark', PHOTO_SCAN.imageTooDarkMessage);
  }
  if (!qualityAssessment.ok && qualityAssessment.rejectReason === 'too_blurry') {
    throw new PantryImageQualityError('too_blurry', PHOTO_SCAN.imageTooBlurryMessage);
  }

  let quality = PHOTO_SCAN.jpegQuality;
  let base64 = canvasToJpegBase64(canvas, quality);
  let byteLength = Math.floor((base64.length * 3) / 4);

  while (byteLength > PHOTO_SCAN.maxPayloadBytes && quality > 0.42) {
    quality -= 0.06;
    base64 = canvasToJpegBase64(canvas, quality);
    byteLength = Math.floor((base64.length * 3) / 4);
  }

  if (byteLength > PHOTO_SCAN.maxPayloadBytes) {
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
  };
}

/** Resize an object URL / data URL (from image picker on web). */
export async function preparePantryImage(uri: string): Promise<PreparedPantryImage> {
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

  const mimeType = blob.type || inferImageMimeType({ name: 'photo.jpg', type: blob.type });
  const file = new File([blob], 'pantry.jpg', { type: mimeType });
  return preparePantryImageFromFile(file);
}
