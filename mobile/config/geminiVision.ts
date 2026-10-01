/**
 * Gemini vision defaults for pantry photo scan.
 * Edge Function `pantry-vision` mirrors these in `supabase/functions/pantry-vision/geminiConfig.ts`.
 */

export const GEMINI_VISION_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Documented default when `GEMINI_MODEL` secret is unset (David may override in Supabase). */
export const DEFAULT_GEMINI_VISION_MODEL = 'gemini-3.6-flash';

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
  'gemini-2.0-flash',
] as const;

export type GeminiVisionModelId =
  | typeof DEFAULT_GEMINI_VISION_MODEL
  | (typeof DEFAULT_GEMINI_VISION_FALLBACK_MODELS)[number]
  | string;
