/**
 * Pantry vision scan orchestration (client + edge function keep behavior aligned).
 */

/** @deprecated Second pass always runs unless the request time budget is exhausted. */
export const PANTRY_VISION_SINGLE_PASS_MIN_ITEMS = 8;
/** @deprecated Second pass always runs unless the request time budget is exhausted. */
export const PANTRY_VISION_SINGLE_PASS_MIN_AVG_CONFIDENCE = 0.72;

/** Run add-missing (verify) pass unless the wall-clock budget cannot fit another Gemini call. */
export function shouldRunPantryVerifySecondPass(budgetExhausted: boolean): boolean {
  return !budgetExhausted;
}

/** Edge function in-memory scan cache version — bump when output shape or logic changes materially. */
export const PANTRY_VISION_CACHE_VERSION = 'v5';
