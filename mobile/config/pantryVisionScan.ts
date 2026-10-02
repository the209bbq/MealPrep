/**
 * Pantry vision scan orchestration (client + edge function keep behavior aligned).
 */

/** Skip second Gemini pass when the first pass looks complete enough. */
export const PANTRY_VISION_SINGLE_PASS_MIN_ITEMS = 8;
export const PANTRY_VISION_SINGLE_PASS_MIN_AVG_CONFIDENCE = 0.72;

/** Edge function in-memory scan cache version — bump when output shape or logic changes materially. */
export const PANTRY_VISION_CACHE_VERSION = 'v4';
