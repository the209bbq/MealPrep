import { PHOTO_SCAN } from '../../config/appConfig';

export type ImageQualityRejectReason = 'blank' | 'too_dark' | 'too_blurry';

export interface ImageQualityAssessment {
  ok: boolean;
  meanLuminance: number;
  laplacianVariance: number;
  luminanceStdDev: number;
  rejectReason?: ImageQualityRejectReason;
}

export interface ImageQualityEvaluation {
  meanLuminance: number;
  laplacianVariance: number;
  luminanceStdDev: number;
  /** Blocks upload — uniform/blank frame only (by default). */
  hardReject?: 'blank';
  hardRejectMessage?: string;
  /** Non-blocking hints; vision still runs. */
  warnings: string[];
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

export function computeLuminanceStdDev(luma: Float32Array): number {
  const n = luma.length;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i += 1) sum += luma[i];
  const mean = sum / n;
  let varSum = 0;
  for (let i = 0; i < n; i += 1) {
    const d = luma[i] - mean;
    varSum += d * d;
  }
  return Math.sqrt(varSum / n);
}

/** Downsample luma for quality analysis (matches native 128px thumb intent; web uses 256 long edge). */
export function downsampleLumaForQualityAnalysis(
  luma: Float32Array,
  width: number,
  height: number,
  maxLongEdge: number = PHOTO_SCAN.qualityAnalysisLongEdge,
): { luma: Float32Array; width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= maxLongEdge) {
    return { luma, width, height };
  }
  const scale = maxLongEdge / long;
  const tw = Math.max(1, Math.round(width * scale));
  const th = Math.max(1, Math.round(height * scale));
  const out = new Float32Array(tw * th);
  for (let y = 0; y < th; y += 1) {
    for (let x = 0; x < tw; x += 1) {
      const sx = Math.min(width - 1, Math.floor(((x + 0.5) * width) / tw));
      const sy = Math.min(height - 1, Math.floor(((y + 0.5) * height) / th));
      out[y * tw + x] = luma[sy * width + sx];
    }
  }
  return { luma: out, width: tw, height: th };
}

export function measureLaplacianVariance(luma: Float32Array, width: number, height: number): number {
  let lapSum = 0;
  let lapCount = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      const center = luma[idx];
      const lap =
        -4 * center + luma[idx - 1] + luma[idx + 1] + luma[idx - width] + luma[idx + width];
      lapSum += lap * lap;
      lapCount += 1;
    }
  }
  return lapCount > 0 ? lapSum / lapCount : 0;
}

/** Score brightness / blur on a (possibly large) luma buffer at analysis resolution. */
export function evaluateImageQuality(
  luma: Float32Array,
  width: number,
  height: number,
): ImageQualityEvaluation {
  const sampled = downsampleLumaForQualityAnalysis(luma, width, height);
  const n = sampled.luma.length;
  let sum = 0;
  for (let i = 0; i < n; i += 1) sum += sampled.luma[i];
  const meanLuminance = n > 0 ? sum / n : 0.5;
  const luminanceStdDev = computeLuminanceStdDev(sampled.luma);
  const laplacianVariance = measureLaplacianVariance(sampled.luma, sampled.width, sampled.height);

  const warnings: string[] = [];
  if (meanLuminance < PHOTO_SCAN.minMeanLuminance) {
    warnings.push(PHOTO_SCAN.imageTooDarkMessage);
  }
  if (laplacianVariance < PHOTO_SCAN.minLaplacianVariance) {
    warnings.push(PHOTO_SCAN.imageTooBlurryMessage);
  }

  const isBlank =
    luminanceStdDev < PHOTO_SCAN.minLuminanceStdDev ||
    laplacianVariance < PHOTO_SCAN.blankLaplacianVariance;

  if (isBlank) {
    return {
      meanLuminance,
      laplacianVariance,
      luminanceStdDev,
      hardReject: 'blank',
      hardRejectMessage: PHOTO_SCAN.imageBlankMessage,
      warnings,
    };
  }

  return { meanLuminance, laplacianVariance, luminanceStdDev, warnings };
}

/** @deprecated Use evaluateImageQuality; kept for scripts that expect hard reject flags. */
export function assessGrayscaleQuality(
  luma: Float32Array,
  width: number,
  height: number,
): ImageQualityAssessment {
  const evaluation = evaluateImageQuality(luma, width, height);
  if (evaluation.hardReject) {
    return {
      ok: false,
      meanLuminance: evaluation.meanLuminance,
      laplacianVariance: evaluation.laplacianVariance,
      luminanceStdDev: evaluation.luminanceStdDev,
      rejectReason: evaluation.hardReject,
    };
  }
  const softBlurry = evaluation.laplacianVariance < PHOTO_SCAN.minLaplacianVariance;
  const softDark = evaluation.meanLuminance < PHOTO_SCAN.minMeanLuminance;
  let rejectReason: ImageQualityRejectReason | undefined;
  if (softDark) rejectReason = 'too_dark';
  else if (softBlurry) rejectReason = 'too_blurry';
  return {
    ok: !rejectReason,
    meanLuminance: evaluation.meanLuminance,
    laplacianVariance: evaluation.laplacianVariance,
    luminanceStdDev: evaluation.luminanceStdDev,
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
