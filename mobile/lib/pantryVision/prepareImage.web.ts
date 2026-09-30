import { PHOTO_SCAN } from '../../config/appConfig';
import type { PreparedPantryImage } from './types';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = src;
  });
}

function canvasToJpegBase64(canvas: HTMLCanvasElement, quality: number): string {
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const base64 = dataUrl.split(',')[1] ?? '';
  return base64;
}

export async function preparePantryImageFromFile(file: File): Promise<PreparedPantryImage> {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const maxDim = PHOTO_SCAN.maxImageDimension;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.drawImage(img, 0, 0, width, height);

  let quality = PHOTO_SCAN.jpegQuality;
  let base64 = canvasToJpegBase64(canvas, quality);
  let byteLength = Math.floor((base64.length * 3) / 4);

  while (byteLength > PHOTO_SCAN.maxPayloadBytes && quality > 0.35) {
    quality -= 0.08;
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
  };
}

/** Resize an object URL / data URL (from image picker on web). */
export async function preparePantryImage(uri: string): Promise<PreparedPantryImage> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const file = new File([blob], 'pantry.jpg', { type: blob.type || 'image/jpeg' });
  return preparePantryImageFromFile(file);
}
