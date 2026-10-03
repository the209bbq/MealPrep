import { getRecipeImportUrl, isDemoMode } from '../../config/appConfig';
import { RECIPE_IMPORT } from '../../config/recipeImport';
import { withTimeout } from '../withTimeout';
import type {
  RecipeImportErrorEnvelope,
  RecipeImportExtractedDto,
  RecipeImportFallbacksDto,
  RecipeImportImagePayload,
  RecipeImportRequestAction,
  RecipeImportSuccessResponse,
} from './types';

export class RecipeImportNotConfiguredError extends Error {
  code = 'NOT_CONFIGURED';
}

export class RecipeImportAuthError extends Error {
  code = 'UNAUTHENTICATED';
}

export class RecipeImportRateLimitError extends Error {
  code = 'RATE_LIMIT';
}

export class RecipeImportNotRecipeError extends Error {
  code = 'NOT_RECIPE';
  fallbacks?: RecipeImportFallbacksDto;
}

export class RecipeImportFallbackRequiredError extends Error {
  code = 'FALLBACK_REQUIRED';
  fallbacks?: RecipeImportFallbacksDto;
}

export class RecipeImportUpstreamError extends Error {
  code = 'UPSTREAM_ERROR';
}

export class RecipeImportCaptionRequiredError extends Error {
  code = 'CAPTION_REQUIRED';
}

export interface RecipeImportCallResult {
  recipe: RecipeImportExtractedDto;
  cached?: boolean;
  confirmedYoutube?: boolean;
}

async function parseError(response: Response, text: string): Promise<never> {
  let json: RecipeImportErrorEnvelope = {};
  try {
    json = JSON.parse(text) as RecipeImportErrorEnvelope;
  } catch {
    /* ignore */
  }
  const message = json.error ?? 'Import failed';
  if (response.status === 503 || json.code === 'NOT_CONFIGURED') {
    throw new RecipeImportNotConfiguredError(message);
  }
  if (response.status === 401 || json.code === 'UNAUTHENTICATED') {
    throw new RecipeImportAuthError(message);
  }
  if (response.status === 429 || json.code === 'RATE_LIMIT') {
    throw new RecipeImportRateLimitError(message);
  }
  if (response.status === 422 && json.code === 'FALLBACK_REQUIRED') {
    const err = new RecipeImportFallbackRequiredError(message);
    err.fallbacks = json.fallbacks;
    throw err;
  }
  if (response.status === 422 && json.code === 'CAPTION_REQUIRED') {
    throw new RecipeImportCaptionRequiredError(message);
  }
  if (response.status === 422 || json.code === 'NOT_RECIPE') {
    const err = new RecipeImportNotRecipeError(message);
    err.fallbacks = json.fallbacks;
    throw err;
  }
  throw new RecipeImportUpstreamError(message);
}

const DEMO_IMPORT: RecipeImportExtractedDto = {
  title: 'Weeknight garlic pasta',
  servings: 4,
  prep_minutes: 10,
  cook_minutes: 15,
  ingredients: [
    { name: 'spaghetti', quantity: 12, unit: 'oz' },
    { name: 'garlic', quantity: 4, unit: 'clove' },
    { name: 'olive oil', quantity: 3, unit: 'tbsp' },
    { name: 'parmesan cheese', quantity: 0.5, unit: 'cup' },
  ],
  steps: [
    'Boil pasta in salted water until al dente.',
    'Sauté sliced garlic in olive oil until fragrant.',
    'Toss pasta with garlic oil and parmesan. Serve warm.',
  ],
  is_recipe: true,
  confidence: 0.9,
  source_url: 'https://example.com/demo-pasta',
  source_type: 'web',
};

async function callRecipeImport(
  accessToken: string | null,
  body: Record<string, unknown>,
): Promise<RecipeImportCallResult> {
  if (isDemoMode()) {
    const url = typeof body.url === 'string' ? body.url : DEMO_IMPORT.source_url;
    return { recipe: { ...DEMO_IMPORT, source_url: url.trim() || DEMO_IMPORT.source_url } };
  }

  const endpoint = getRecipeImportUrl();
  if (!endpoint) {
    throw new RecipeImportNotConfiguredError(RECIPE_IMPORT.notConfiguredMessage);
  }
  if (!accessToken) {
    throw new RecipeImportAuthError('Sign in to import recipes.');
  }

  const response = await withTimeout(
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify(body),
    }),
    RECIPE_IMPORT.requestTimeoutMs,
    'Recipe import timed out',
  );

  const text = await response.text();
  if (!response.ok) {
    await parseError(response, text);
  }

  const json = JSON.parse(text) as RecipeImportSuccessResponse;
  if (!json.recipe?.title) {
    throw new RecipeImportUpstreamError(RECIPE_IMPORT.importFailedMessage);
  }
  return {
    recipe: json.recipe,
    cached: json.cached,
    confirmedYoutube: json.confirmedYoutube,
  };
}

export async function importRecipeFromLink(
  url: string,
  accessToken: string | null,
  options?: { captionText?: string },
): Promise<RecipeImportExtractedDto> {
  const result = await callRecipeImport(accessToken, {
    action: 'link' satisfies RecipeImportRequestAction,
    url,
    captionText: options?.captionText?.trim() || undefined,
  });
  return result.recipe;
}

export async function confirmYoutubeRecipeImport(
  youtubeUrl: string,
  accessToken: string | null,
): Promise<RecipeImportExtractedDto> {
  const result = await callRecipeImport(accessToken, {
    action: 'confirm_youtube',
    youtubeUrl,
  });
  return result.recipe;
}

export async function importRecipeFromPhotos(
  images: RecipeImportImagePayload[],
  accessToken: string | null,
): Promise<RecipeImportExtractedDto> {
  const result = await callRecipeImport(accessToken, {
    action: 'photo',
    images,
  });
  return result.recipe;
}

export async function importRecipeFromScreenshots(
  images: RecipeImportImagePayload[],
  accessToken: string | null,
  options?: { url?: string; captionText?: string },
): Promise<RecipeImportExtractedDto> {
  const result = await callRecipeImport(accessToken, {
    action: 'screenshot',
    images,
    url: options?.url,
    captionText: options?.captionText,
  });
  return result.recipe;
}

export async function importRecipeFromUploadedVideoPath(
  videoStoragePath: string,
  accessToken: string | null,
): Promise<RecipeImportExtractedDto> {
  const result = await callRecipeImport(accessToken, {
    action: 'video',
    videoStoragePath,
  });
  return result.recipe;
}

export function extractUrlFromSharedText(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0].replace(/[)\]"']+$/, '') : null;
}

export function shareTargetImportRoute(params: {
  url?: string;
  text?: string;
}): { path: '/recipes'; query: Record<string, string> } {
  const direct = params.url?.trim() ?? '';
  const fromText = params.text ? extractUrlFromSharedText(params.text) : null;
  const url = direct || fromText || '';
  const query: Record<string, string> = { import: '1' };
  if (url) query.url = url;
  else if (params.text?.trim()) query.text = params.text.trim();
  return { path: '/recipes', query };
}
