import jpeg from 'jpeg-js';
import {
  evaluateImageQuality,
  type ImageQualityAssessment,
  type ImageQualityEvaluation,
} from './prepareImageShared';

function decodeJpegBase64ToLuma(base64: string): { luma: Float32Array; width: number; height: number } {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  const decoded = jpeg.decode(bytes, { useTArray: true });
  const { width, height, data } = decoded;
  const luma = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    luma[p] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  return { luma, width, height };
}

export function evaluateJpegBase64Quality(base64: string): ImageQualityEvaluation {
  const { luma, width, height } = decodeJpegBase64ToLuma(base64);
  return evaluateImageQuality(luma, width, height);
}

/** Decode a small JPEG base64 thumb and score brightness / blur. */
export function assessJpegBase64Quality(base64: string): ImageQualityAssessment {
  const evaluation = evaluateJpegBase64Quality(base64);
  if (evaluation.hardReject) {
    return {
      ok: false,
      meanLuminance: evaluation.meanLuminance,
      laplacianVariance: evaluation.laplacianVariance,
      luminanceStdDev: evaluation.luminanceStdDev,
      rejectReason: evaluation.hardReject,
    };
  }
  return {
    ok: true,
    meanLuminance: evaluation.meanLuminance,
    laplacianVariance: evaluation.laplacianVariance,
    luminanceStdDev: evaluation.luminanceStdDev,
  };
}
