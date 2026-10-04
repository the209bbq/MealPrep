/**
 * Server-side pantry photo region crops for focused Gemini passes.
 * Unit tests import this module (see pantry-vision-regions-check.ts).
 */

export type NormalizedRect = {
  /** Left edge, 0–1 */
  x: number;
  /** Top edge, 0–1 */
  y: number;
  /** Width, 0–1 */
  w: number;
  /** Height, 0–1 */
  h: number;
};

export type PantryRegionSpec = {
  id: string;
  /** Human label for prompts, e.g. "lower half" */
  label: string;
  crop: NormalizedRect;
};

const MIN_REGION_DIMENSION_PX = 120;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Read width/height from JPEG or PNG headers (no full decode). */
export function readImageDimensions(
  bytes: Uint8Array,
  mimeType: string,
): { width: number; height: number } | null {
  const mime = mimeType.toLowerCase();
  if (mime === 'image/png' && bytes.length >= 24) {
    const width =
      (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    const height =
      (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    if (width > 0 && height > 0) return { width, height };
    return null;
  }

  if ((mime === 'image/jpeg' || mime === 'image/jpg') && bytes.length >= 4) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xd8) {
        offset += 2;
        continue;
      }
      if (marker === 0xd9 || marker === 0xda) break;
      const segmentLength = (bytes[offset + 2] << 8) + bytes[offset + 3];
      if (segmentLength < 2) break;
      const isSof =
        marker === 0xc0 ||
        marker === 0xc1 ||
        marker === 0xc2 ||
        marker === 0xc3 ||
        marker === 0xc5 ||
        marker === 0xc6 ||
        marker === 0xc7 ||
        marker === 0xc9 ||
        marker === 0xca ||
        marker === 0xcb ||
        marker === 0xcd ||
        marker === 0xce ||
        marker === 0xcf;
      if (isSof && offset + 8 < bytes.length) {
        const height = (bytes[offset + 5] << 8) + bytes[offset + 6];
        const width = (bytes[offset + 7] << 8) + bytes[offset + 8];
        if (width > 0 && height > 0) return { width, height };
      }
      offset += 2 + segmentLength;
    }
  }

  return null;
}

/** 2–4 crops emphasizing lower/back rows and wide shelves. */
export function planPantryRegionSpecs(width: number, height: number): PantryRegionSpec[] {
  if (width < MIN_REGION_DIMENSION_PX || height < MIN_REGION_DIMENSION_PX) return [];

  const aspect = width / height;
  const specs: PantryRegionSpec[] = [];

  if (aspect >= 1.35) {
    specs.push({
      id: 'left',
      label: 'left half of the shelf',
      crop: { x: 0, y: 0, w: 0.5, h: 1 },
    });
    specs.push({
      id: 'right',
      label: 'right half of the shelf',
      crop: { x: 0.5, y: 0, w: 0.5, h: 1 },
    });
    specs.push({
      id: 'lower',
      label: 'lower half of the shelf (bottom shelves and floor-level items)',
      crop: { x: 0, y: 0.5, w: 1, h: 0.5 },
    });
  } else {
    specs.push({
      id: 'upper',
      label: 'upper half of the shelf',
      crop: { x: 0, y: 0, w: 1, h: 0.5 },
    });
    specs.push({
      id: 'lower',
      label: 'lower half of the shelf (bottom shelves, partially hidden and back-row items)',
      crop: { x: 0, y: 0.5, w: 1, h: 0.5 },
    });
    if (height / width >= 1.45) {
      specs.push({
        id: 'bottom_third',
        label: 'bottom third of the shelf (lowest row and items tucked behind others)',
        crop: { x: 0, y: 0.66, w: 1, h: 0.34 },
      });
    }
  }

  return specs.slice(0, 4);
}

function rectToPixels(
  crop: NormalizedRect,
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number } {
  const x = clamp01(crop.x);
  const y = clamp01(crop.y);
  const w = clamp01(crop.w);
  const h = clamp01(crop.h);
  let left = Math.floor(x * width);
  let top = Math.floor(y * height);
  let cropW = Math.max(MIN_REGION_DIMENSION_PX, Math.floor(w * width));
  let cropH = Math.max(MIN_REGION_DIMENSION_PX, Math.floor(h * height));
  if (left + cropW > width) left = Math.max(0, width - cropW);
  if (top + cropH > height) top = Math.max(0, height - cropH);
  cropW = Math.min(cropW, width - left);
  cropH = Math.min(cropH, height - top);
  return { left, top, width: cropW, height: cropH };
}

type CropImageBitmap = {
  width: number;
  height: number;
  close: () => void;
};

type CropSurface = {
  width: number;
  height: number;
  getContext: (type: '2d') => {
    drawImage: (
      source: CropImageBitmap,
      sx: number,
      sy: number,
      sw: number,
      sh: number,
      dx: number,
      dy: number,
      dw: number,
      dh: number,
    ) => void;
  } | null;
  convertToBlob: (options: { type: string; quality?: number }) => Promise<Blob>;
};

declare const createImageBitmap: (
  source: Blob,
  sx?: number,
  sy?: number,
  sw?: number,
  sh?: number,
) => Promise<CropImageBitmap>;

declare const OffscreenCanvas: new (width: number, height: number) => CropSurface;

/** Crop image bytes; returns null when the runtime cannot decode images. */
export async function cropPantryImageBytes(
  bytes: Uint8Array,
  mimeType: string,
  crop: NormalizedRect,
): Promise<Uint8Array | null> {
  const dims = readImageDimensions(bytes, mimeType);
  if (!dims) return null;

  const globalScope = globalThis as {
    createImageBitmap?: typeof createImageBitmap;
    OffscreenCanvas?: typeof OffscreenCanvas;
  };
  if (!globalScope.createImageBitmap || !globalScope.OffscreenCanvas) {
    return null;
  }

  const { left, top, width, height } = rectToPixels(crop, dims.width, dims.height);
  const blob = new Blob([bytes], { type: mimeType });

  let bitmap: CropImageBitmap | null = null;
  try {
    bitmap = await globalScope.createImageBitmap(blob, left, top, width, height);
    const canvas = new globalScope.OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, bitmap.width, bitmap.height);
    const outMime = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
    const quality = outMime === 'image/jpeg' ? 0.88 : undefined;
    const outBlob = await canvas.convertToBlob({ type: outMime, quality });
    const buffer = await outBlob.arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

export async function buildPantryRegionImageBase64List(
  bytes: Uint8Array,
  mimeType: string,
): Promise<Array<{ spec: PantryRegionSpec; base64: string }>> {
  const dims = readImageDimensions(bytes, mimeType);
  if (!dims) return [];

  const specs = planPantryRegionSpecs(dims.width, dims.height);
  const out: Array<{ spec: PantryRegionSpec; base64: string }> = [];

  for (const spec of specs) {
    const cropped = await cropPantryImageBytes(bytes, mimeType, spec.crop);
    if (!cropped || cropped.length === 0) continue;
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < cropped.length; i += chunk) {
      binary += String.fromCharCode(...cropped.subarray(i, i + chunk));
    }
    out.push({ spec, base64: btoa(binary) });
  }

  return out;
}
