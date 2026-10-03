import {
  GEMINI_HTTP_RETRIES_PER_MODEL,
  GEMINI_REQUEST_TIMEOUT_MS,
  GEMINI_REQUEST_TOTAL_BUDGET_MS,
  ModelTimeoutMemory,
  RequestTimeBudget,
  orderModelsForAttempt,
  shouldRetrySameModelAfterError,
} from '../pantry-vision/geminiOrchestration.ts';
import {
  GEMINI_RECIPE_IMPORT_JSON_SCHEMA,
  validateGeminiRecipeImportPayload,
  type RecipeImportExtracted,
} from './recipeImportSchema.ts';
import type { RecipeImportSourceType } from './urlClassification.ts';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_DETERMINISTIC_SEED = 42;
const GEMINI_MAX_OUTPUT_TOKENS = 8192;

const geminiModelTimeoutMemory = new ModelTimeoutMemory();

type GeminiAttemptError = {
  kind: 'timeout' | 'http';
  status?: number;
  detail: string;
  retryable?: boolean;
};

const TEXT_EXTRACTION_PROMPT =
  'Extract a home-cooking recipe from the page text. Use generic ingredient names (no brands). ' +
  'Return clear step-by-step instructions as short strings. If this is not a recipe, set is_recipe false and confidence low.';

const YOUTUBE_EXTRACTION_PROMPT =
  'Watch this cooking video and extract the recipe. Focus on clear step-by-step INSTRUCTIONS and ingredients with quantities and units. ' +
  'Use generic ingredient names (no brands). If this is not a recipe video, set is_recipe false with a low confidence score.';

async function callGeminiJson(
  apiKey: string,
  model: string,
  parts: Record<string, unknown>[],
  budget: RequestTimeBudget,
): Promise<{ payload: unknown } | { error: GeminiAttemptError }> {
  const timeoutMs = budget.perCallTimeoutMs(GEMINI_REQUEST_TIMEOUT_MS);
  if (timeoutMs == null) {
    return { error: { kind: 'timeout', detail: 'budget exhausted', retryable: false } };
  }

  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: GEMINI_RECIPE_IMPORT_JSON_SCHEMA,
      temperature: 0,
      topP: 0.1,
      seed: GEMINI_DETERMINISTIC_SEED,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
    },
  };

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const isTimeout =
      error instanceof DOMException
        ? error.name === 'TimeoutError'
        : error instanceof Error && error.name === 'TimeoutError';
    return {
      error: {
        kind: isTimeout ? 'timeout' : 'http',
        detail: error instanceof Error ? error.message : 'network error',
        retryable: !isTimeout,
      },
    };
  }

  const text = await upstream.text();
  if (!upstream.ok) {
    return {
      error: {
        kind: 'http',
        status: upstream.status,
        detail: text.slice(0, 320),
        retryable: upstream.status === 429 || upstream.status >= 500,
      },
    };
  }

  try {
    const envelope = JSON.parse(text) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const partText =
      envelope.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!partText) {
      return { error: { kind: 'http', status: 502, detail: 'empty model response', retryable: true } };
    }
    return { payload: JSON.parse(partText) as unknown };
  } catch (error) {
    return {
      error: {
        kind: 'http',
        status: 502,
        detail: error instanceof Error ? error.message : 'parse error',
        retryable: false,
      },
    };
  }
}

async function callGeminiWithFallback(
  apiKey: string,
  parts: Record<string, unknown>[],
): Promise<RecipeImportExtracted | null> {
  const budget = new RequestTimeBudget(GEMINI_REQUEST_TOTAL_BUDGET_MS);
  const candidates = orderModelsForAttempt(
    Deno.env.get('GEMINI_MODEL') ?? undefined,
    Deno.env.get('GEMINI_FALLBACK_MODELS') ?? undefined,
    geminiModelTimeoutMemory,
  );

  for (const model of candidates) {
    if (budget.isExhausted()) break;
    let httpRetries = 0;
    for (;;) {
      const result = await callGeminiJson(apiKey, model, parts, budget);
      if ('payload' in result) {
        const validated = validateGeminiRecipeImportPayload(result.payload);
        if (validated) return validated;
        break;
      }
      if (result.error.kind === 'timeout') {
        geminiModelTimeoutMemory.record(model);
        break;
      }
      if (
        shouldRetrySameModelAfterError(result.error, httpRetries, GEMINI_HTTP_RETRIES_PER_MODEL)
      ) {
        httpRetries += 1;
        continue;
      }
      break;
    }
  }
  return null;
}

export async function extractRecipeFromYouTubeVideo(
  apiKey: string,
  youtubeUrl: string,
  sourceType: RecipeImportSourceType,
  sourceUrl: string,
): Promise<RecipeImportExtracted | null> {
  const parts = [
    { file_data: { mime_type: 'video/*', file_uri: youtubeUrl } },
    { text: YOUTUBE_EXTRACTION_PROMPT },
  ];
  const extracted = await callGeminiWithFallback(apiKey, parts);
  if (!extracted) return null;
  return {
    ...extracted,
    source_url: sourceUrl,
    source_type: sourceType,
    source_title: extracted.title,
  };
}

export async function extractRecipeFromPageText(
  apiKey: string,
  pageText: string,
  sourceUrl: string,
): Promise<RecipeImportExtracted | null> {
  const parts = [
    {
      text: `${TEXT_EXTRACTION_PROMPT}\n\nSource URL: ${sourceUrl}\n\nPage text:\n${pageText}`,
    },
  ];
  const extracted = await callGeminiWithFallback(apiKey, parts);
  if (!extracted) return null;
  return {
    ...extracted,
    source_url: sourceUrl,
    source_type: 'web',
    source_title: extracted.title,
  };
}
