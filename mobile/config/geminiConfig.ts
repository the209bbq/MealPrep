/**
 * Shared Gemini vision model defaults for pantry photo scan.
 * Keep in sync with `supabase/functions/pantry-vision/geminiOrchestration.ts` (@sync marker).
 */

/** Default when `GEMINI_MODEL` secret is unset — favor model that performs best on pantry photos. */
export const DEFAULT_GEMINI_VISION_MODEL = 'gemini-3.8-flash';

/**
 * Ordered backups when the primary model errors (429/5xx/timeout/retired).
 * Override entirely via optional `GEMINI_FALLBACK_MODELS` secret (comma-separated).
 */
export const DEFAULT_GEMINI_VISION_FALLBACK_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
] as const;

/** Per Gemini HTTP call; edge function reads `GEMINI_REQUEST_TIMEOUT_MS` secret (same default). */
export const DEFAULT_GEMINI_VISION_REQUEST_TIMEOUT_MS = 38_000;

export type GeminiVisionModelId =
  | typeof DEFAULT_GEMINI_VISION_MODEL
  | (typeof DEFAULT_GEMINI_VISION_FALLBACK_MODELS)[number]
  | string;
