/**
 * Pantry vision scan orchestration (client + edge function keep behavior aligned).
 */

/** @deprecated Second pass always runs unless the request time budget is exhausted. */
export const PANTRY_VISION_SINGLE_PASS_MIN_ITEMS = 8;
/** @deprecated Second pass always runs unless the request time budget is exhausted. */
export const PANTRY_VISION_SINGLE_PASS_MIN_AVG_CONFIDENCE = 0.72;

/** One Gemini vision call per photo (free-tier budget). */
export function shouldRunPantryVerifySecondPass(_budgetExhausted: boolean): boolean {
  return false;
}

/** Edge function in-memory scan cache version — bump when output shape or logic changes materially. */
export const PANTRY_VISION_CACHE_VERSION = 'v6';
