import { AVATARS } from '../../config/avatars';
import { computeLongEdgeResize } from '../pantryVision/prepareImageShared';
import type { PreparedAvatarImage } from './types';

async function loadImageFromFile(file: File): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  return { bitmap, width: bitmap.width, height: bitmap.height };
}

function canvasToJpegBase64(canvas: HTMLCanvasElement, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not encode profile photo.'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(',')[1] ?? '';
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Could not read encoded photo.'));
        reader.readAsDataURL(blob);
      },
      'image/jpeg',
      quality,
    );
  });
}

export async function prepareAvatarImageFromFile(file: File): Promise<PreparedAvatarImage> {
  const { bitmap, width, height } = await loadImageFromFile(file);
  const { width: targetW, height: targetH } = computeLongEdgeResize(width, height, AVATARS.maxLongEdge);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare profile photo.');
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  let quality = AVATARS.jpegQuality;
  let base64 = await canvasToJpegBase64(canvas, quality);
  let byteLength = Math.floor((base64.length * 3) / 4);

  while (byteLength > AVATARS.maxBytes && quality > 0.45) {
    quality -= 0.08;
    base64 = await canvasToJpegBase64(canvas, quality);
    byteLength = Math.floor((base64.length * 3) / 4);
  }

  if (byteLength > AVATARS.maxBytes) {
    throw new Error('Photo is still too large. Try a smaller image.');
  }

  const objectUrl = URL.createObjectURL(
    new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], { type: 'image/jpeg' }),
  );

  return {
    uri: objectUrl,
    mimeType: 'image/jpeg',
    base64,
    byteLength,
  };
}
