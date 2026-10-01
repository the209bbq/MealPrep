export type PantryScanFailureReason =
  | 'NOT_CONFIGURED'
  | 'UNAUTHENTICATED'
  | 'RATE_LIMIT'
  | 'BAD_IMAGE'
  | 'IMAGE_TOO_DARK'
  | 'IMAGE_TOO_BLURRY'
  | 'IMAGE_TOO_LARGE'
  | 'NETWORK'
  | 'UPSTREAM_BUSY'
  | 'UPSTREAM_ERROR'
  | 'EMPTY_DETECTIONS'
  | 'UNEXPECTED_RESPONSE'
  | 'UNKNOWN';

export function logPantryScanFailure(reason: PantryScanFailureReason, detail?: string): void {
  const safeDetail = detail?.replace(/Bearer\s+\S+/gi, '[redacted]').slice(0, 240);
  console.warn('[pantry-scan]', { reason, detail: safeDetail ?? undefined });
}
