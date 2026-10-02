/**
 * Gemini vision defaults for pantry photo scan.
 * Edge Function `pantry-vision` mirrors `config/geminiConfig.ts` in geminiOrchestration.ts.
 */

export {
  DEFAULT_GEMINI_VISION_FALLBACK_MODELS,
  DEFAULT_GEMINI_VISION_MODEL,
  type GeminiVisionModelId,
} from './geminiConfig';

export const GEMINI_VISION_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
