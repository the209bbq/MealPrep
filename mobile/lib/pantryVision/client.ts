import { getPantryVisionUrl, isDemoMode, PHOTO_SCAN } from '../../config/appConfig';
import { DEFAULT_PANTRY_STORAGE_LOCATION, type PantryStorageLocation } from '../../config/pantryStorage';
import { withTimeout } from '../withTimeout';
import { getDemoPantryDetections } from './demoSamples';
import { pantryImageContentHash } from './imageHash';
import { getCachedPantryScan, pantryScanCacheKey, setCachedPantryScan } from './scanCache';
import { logPantryScanFailure, type PantryScanFailureReason } from './scanLog';
import type { PantryVisionErrorEnvelope, PantryVisionResponse, PreparedPantryImage } from './types';

const PANTRY_VISION_REQUEST_MS = 95_000;

export class PantryVisionNotConfiguredError extends Error {
  code = 'NOT_CONFIGURED';
  constructor(message: string) {
    super(message);
    this.name = 'PantryVisionNotConfiguredError';
  }
}

export class PantryVisionAuthError extends Error {
  code = 'UNAUTHENTICATED';
  constructor(message: string) {
    super(message);
    this.name = 'PantryVisionAuthError';
  }
}

export class PantryVisionRateLimitError extends Error {
  code = 'RATE_LIMIT';
  constructor(message: string) {
    super(message);
    this.name = 'PantryVisionRateLimitError';
  }
}

export class PantryVisionScanError extends Error {
  code: PantryScanFailureReason;
  constructor(message: string, code: PantryScanFailureReason = 'UNKNOWN') {
    super(message);
    this.name = 'PantryVisionScanError';
    this.code = code;
  }
}

async function parseErrorResponse(response: Response, text: string): Promise<never> {
  let json: PantryVisionErrorEnvelope = {};
  try {
    json = JSON.parse(text) as PantryVisionErrorEnvelope;
  } catch {
    /* ignore */
  }

  if (response.status === 503 && (json.code === 'NOT_CONFIGURED' || json.error?.includes('not set up'))) {
    logPantryScanFailure('NOT_CONFIGURED');
    throw new PantryVisionNotConfiguredError(
      json.error ?? 'Pantry photo scan is not configured on the server.',
    );
  }
  if (response.status === 401 || json.code === 'UNAUTHENTICATED') {
    logPantryScanFailure('UNAUTHENTICATED');
    throw new PantryVisionAuthError(json.error ?? 'Sign in to scan your pantry.');
  }
  if (response.status === 429 || json.code === 'RATE_LIMIT') {
    logPantryScanFailure('RATE_LIMIT');
    throw new PantryVisionRateLimitError(json.error ?? PHOTO_SCAN.rateLimitMessage);
  }
  if (response.status === 400 || json.code === 'BAD_REQUEST' || json.code === 'PAYLOAD_TOO_LARGE') {
    logPantryScanFailure(json.code === 'PAYLOAD_TOO_LARGE' ? 'IMAGE_TOO_LARGE' : 'BAD_IMAGE');
    throw new PantryVisionScanError(PHOTO_SCAN.scanFailedMessage, 'BAD_IMAGE');
  }
  if (response.status === 502 || json.code === 'UPSTREAM_ERROR') {
    logPantryScanFailure('UPSTREAM_BUSY', json.error);
    throw new PantryVisionScanError(PHOTO_SCAN.scanBusyMessage, 'UPSTREAM_BUSY');
  }
  logPantryScanFailure('UPSTREAM_ERROR', json.error);
  throw new PantryVisionScanError(PHOTO_SCAN.scanBusyMessage, 'UPSTREAM_ERROR');
}

export interface AnalyzePantryPhotoOptions {
  scanLocation?: PantryStorageLocation;
  /** Skip client memory cache (e.g. explicit “scan again” for coverage). */
  bypassCache?: boolean;
}

export async function ensurePreparedImageHash(prepared: PreparedPantryImage): Promise<PreparedPantryImage> {
  if (prepared.contentHash) return prepared;
  const contentHash = await pantryImageContentHash(prepared.base64, prepared.mimeType);
  return { ...prepared, contentHash };
}

export async function analyzePantryPhoto(
  prepared: PreparedPantryImage,
  accessToken: string | null,
  options?: AnalyzePantryPhotoOptions,
): Promise<PantryVisionResponse> {
  const scanLocation = options?.scanLocation ?? DEFAULT_PANTRY_STORAGE_LOCATION;
  if (isDemoMode()) {
    return { items: getDemoPantryDetections(), model: 'demo-samples' };
  }

  const url = getPantryVisionUrl();
  if (!url) {
    logPantryScanFailure('NOT_CONFIGURED');
    throw new PantryVisionNotConfiguredError(PHOTO_SCAN.notConfiguredMessage);
  }
  if (!accessToken) {
    logPantryScanFailure('UNAUTHENTICATED');
    throw new PantryVisionAuthError('Sign in to scan your pantry.');
  }

  const withHash = await ensurePreparedImageHash(prepared);
  const cacheKey = pantryScanCacheKey(withHash.contentHash ?? '', scanLocation);
  if (!options?.bypassCache) {
    const cached = getCachedPantryScan(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }
  }

  const request = fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      imageBase64: withHash.base64,
      mimeType: withHash.mimeType,
      location: scanLocation,
      imageHash: withHash.contentHash,
    }),
  });

  let response: Response;
  try {
    response = await withTimeout(request, PANTRY_VISION_REQUEST_MS, PHOTO_SCAN.scanBusyMessage);
  } catch {
    logPantryScanFailure('NETWORK');
    throw new PantryVisionScanError(PHOTO_SCAN.scanFailedMessage, 'NETWORK');
  }

  const text = await response.text();
  if (!response.ok) {
    await parseErrorResponse(response, text);
  }

  try {
    const parsed = JSON.parse(text) as PantryVisionResponse;
    if (!options?.bypassCache) {
      setCachedPantryScan(cacheKey, parsed);
    }
    return parsed;
  } catch {
    logPantryScanFailure('UNEXPECTED_RESPONSE');
    throw new PantryVisionScanError(PHOTO_SCAN.scanFailedMessage, 'UNEXPECTED_RESPONSE');
  }
}
