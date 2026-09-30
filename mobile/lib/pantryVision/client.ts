import { getPantryVisionUrl, isDemoMode, PHOTO_SCAN } from '../../config/appConfig';
import { DEFAULT_PANTRY_STORAGE_LOCATION, type PantryStorageLocation } from '../../config/pantryStorage';
import { getDemoPantryDetections } from './demoSamples';
import type { PantryVisionErrorEnvelope, PantryVisionResponse, PreparedPantryImage } from './types';

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

async function parseErrorResponse(
  response: Response,
  text: string,
): Promise<never> {
  let json: PantryVisionErrorEnvelope = {};
  try {
    json = JSON.parse(text) as PantryVisionErrorEnvelope;
  } catch {
    /* ignore */
  }

  if (response.status === 503 && (json.code === 'NOT_CONFIGURED' || json.error?.includes('not set up'))) {
    throw new PantryVisionNotConfiguredError(
      json.error ?? 'Pantry photo scan is not configured on the server.',
    );
  }
  if (response.status === 401 || json.code === 'UNAUTHENTICATED') {
    throw new PantryVisionAuthError(json.error ?? 'Sign in to scan your pantry.');
  }
  if (response.status === 429 || json.code === 'RATE_LIMIT') {
    throw new PantryVisionRateLimitError(json.error ?? PHOTO_SCAN.rateLimitMessage);
  }
  throw new Error(json.error ?? `Pantry scan failed (${response.status})`);
}

export interface AnalyzePantryPhotoOptions {
  scanLocation?: PantryStorageLocation;
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
    throw new PantryVisionNotConfiguredError(PHOTO_SCAN.notConfiguredMessage);
  }
  if (!accessToken) {
    throw new PantryVisionAuthError('Sign in to scan your pantry.');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      imageBase64: prepared.base64,
      mimeType: prepared.mimeType,
      location: scanLocation,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    await parseErrorResponse(response, text);
  }

  try {
    return JSON.parse(text) as PantryVisionResponse;
  } catch {
    throw new Error('Unexpected response from pantry vision');
  }
}
