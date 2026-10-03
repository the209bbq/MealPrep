import { getRecipeImportUrl, isDemoMode } from '../../config/appConfig';
import { RECIPE_IMPORT } from '../../config/recipeImport';
import { withTimeout } from '../withTimeout';
import type {
  RecipeImportErrorEnvelope,
  RecipeImportExtractedDto,
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
}

export class RecipeImportUpstreamError extends Error {
  code = 'UPSTREAM_ERROR';
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
  if (response.status === 422 && json.code === 'CAPTION_REQUIRED') {
    throw new RecipeImportCaptionRequiredError(message);
  }
  if (response.status === 422 || json.code === 'NOT_RECIPE') {
    throw new RecipeImportNotRecipeError(message);
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

export class RecipeImportCaptionRequiredError extends Error {
  code = 'CAPTION_REQUIRED';
}

export async function importRecipeFromLink(
  url: string,
  accessToken: string | null,
  options?: { captionText?: string },
): Promise<RecipeImportExtractedDto> {
  if (isDemoMode()) {
    return { ...DEMO_IMPORT, source_url: url.trim() || DEMO_IMPORT.source_url };
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
      body: JSON.stringify({
        url,
        captionText: options?.captionText?.trim() || undefined,
      }),
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
  return json.recipe;
}
