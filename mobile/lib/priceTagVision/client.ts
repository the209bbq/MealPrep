import { getPantryVisionUrl, isDemoMode, PHOTO_SCAN } from '../../config/appConfig';
import { SMART_SHOP_COPY } from '../../config/smartShop';
import type { PreparedPantryImage } from '../pantryVision/types';
import {
  PantryVisionAuthError,
  PantryVisionNotConfiguredError,
  PantryVisionRateLimitError,
  PantryVisionScanError,
} from '../pantryVision/client';
import type { PriceTagVisionErrorEnvelope, PriceTagVisionResult } from './types';

async function parseErrorResponse(response: Response, text: string): Promise<never> {
  let json: PriceTagVisionErrorEnvelope = {};
  try {
    json = JSON.parse(text) as PriceTagVisionErrorEnvelope;
  } catch {
    /* ignore */
  }

  if (response.status === 503 && (json.code === 'NOT_CONFIGURED' || json.error?.includes('not set up'))) {
    throw new PantryVisionNotConfiguredError(json.error ?? SMART_SHOP_COPY.addPriceScanNotConfigured);
  }
  if (response.status === 401 || json.code === 'UNAUTHENTICATED') {
    throw new PantryVisionAuthError(json.error ?? 'Sign in to scan a shelf tag.');
  }
  if (response.status === 429 || json.code === 'RATE_LIMIT') {
    throw new PantryVisionRateLimitError(json.error ?? PHOTO_SCAN.rateLimitMessage);
  }
  if (response.status === 502 && json.code === 'UPSTREAM_ERROR') {
    throw new PantryVisionScanError(SMART_SHOP_COPY.addPriceScanFailed);
  }
  throw new PantryVisionScanError(json.error ?? SMART_SHOP_COPY.addPriceScanFailed);
}

export async function analyzePriceTagPhoto(
  prepared: PreparedPantryImage,
  accessToken: string | null,
): Promise<PriceTagVisionResult> {
  if (isDemoMode()) {
    return {
      itemName: 'Demo: whole milk',
      price: 3.99,
      sizeUnit: '1 gal',
      saleValidUntil: null,
      model: 'demo-samples',
    };
  }

  const url = getPantryVisionUrl();
  if (!url) {
    throw new PantryVisionNotConfiguredError(SMART_SHOP_COPY.addPriceScanNotConfigured);
  }
  if (!accessToken) {
    throw new PantryVisionAuthError('Sign in to scan a shelf tag.');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      action: 'price-tag',
      imageBase64: prepared.base64,
      mimeType: prepared.mimeType,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    await parseErrorResponse(response, text);
  }

  try {
    const parsed = JSON.parse(text) as PriceTagVisionResult & { error?: string };
    if (!parsed.itemName || !Number.isFinite(Number(parsed.price))) {
      throw new PantryVisionScanError(SMART_SHOP_COPY.addPriceScanFailed);
    }
    return {
      itemName: String(parsed.itemName).trim(),
      price: Number(parsed.price),
      sizeUnit: parsed.sizeUnit?.trim() || undefined,
      saleValidUntil: parsed.saleValidUntil ?? undefined,
      model: parsed.model,
    };
  } catch (error) {
    if (error instanceof PantryVisionScanError) throw error;
    throw new PantryVisionScanError(SMART_SHOP_COPY.addPriceScanFailed);
  }
}
