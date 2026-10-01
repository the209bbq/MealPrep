import { PHOTO_SCAN } from '../../config/appConfig';
import { assessGrayscaleQuality, computeLongEdgeResize, PantryImageQualityError } from './prepareImageShared';
import type { PreparedPantryImage } from './types';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      return await createImageBitmap(file);
    }
  }
  const dataUrl = await readFileAsDataUrl(file);
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

function canvasToJpegBase64(canvas: HTMLCanvasElement, quality: number): string {
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return dataUrl.split(',')[1] ?? '';
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
  const response = await fetch(uri);
  const blob = await response.blob();
  const file = new File([blob], 'pantry.jpg', { type: blob.type || 'image/jpeg' });
  return preparePantryImageFromFile(file);
}
