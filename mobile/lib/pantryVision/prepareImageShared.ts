import { PHOTO_SCAN } from '../../config/appConfig';

export type ImageQualityRejectReason = 'too_dark' | 'too_blurry';

export interface ImageQualityAssessment {
  ok: boolean;
  meanLuminance: number;
  laplacianVariance: number;
  rejectReason?: ImageQualityRejectReason;
}

export function computeLongEdgeResize(
  width: number,
  height: number,
  maxLongEdge: number = PHOTO_SCAN.maxImageDimension,
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) {
    return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
  }
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function assessGrayscaleQuality(
  luma: Float32Array,
  width: number,
  height: number,
): ImageQualityAssessment {
  const n = luma.length;
  if (n === 0) {
    return { ok: true, meanLuminance: 0.5, laplacianVariance: 100 };
  }

  let sum = 0;
  for (let i = 0; i < n; i += 1) sum += luma[i];
  const meanLuminance = sum / n;

  let lapSum = 0;
  let lapCount = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      const center = luma[idx];
      const lap =
        -4 * center +
        luma[idx - 1] +
        luma[idx + 1] +
        luma[idx - width] +
        luma[idx + width];
      lapSum += lap * lap;
      lapCount += 1;
    }
  }
  const laplacianVariance = lapCount > 0 ? lapSum / lapCount : 0;

  let rejectReason: ImageQualityRejectReason | undefined;
  if (meanLuminance < PHOTO_SCAN.minMeanLuminance) rejectReason = 'too_dark';
  else if (laplacianVariance < PHOTO_SCAN.minLaplacianVariance) rejectReason = 'too_blurry';

  return {
    ok: !rejectReason,
    meanLuminance,
    laplacianVariance,
    rejectReason,
  };
}

export class PantryImageQualityError extends Error {
  readonly reason: ImageQualityRejectReason;
  constructor(reason: ImageQualityRejectReason, message: string) {
    super(message);
    this.name = 'PantryImageQualityError';
    this.reason = reason;
  }
}
