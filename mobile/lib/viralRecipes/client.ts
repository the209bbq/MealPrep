import { getViralRecipesUrl, isDemoMode, SUPABASE_ANON_KEY } from '../../config/appConfig';
import { VIRAL_RECIPES, VIRAL_RECIPES_COPY, type ViralRecipesCategory } from '../../config/viralRecipes';
import { withTimeout } from '../withTimeout';
import type { ViralRecipesErrorEnvelope, ViralRecipesFetchResult } from './types';
import { demoViralRecipeItems } from './demoSamples';

export class ViralRecipesNotConfiguredError extends Error {
  code = 'NOT_CONFIGURED';
}

export class ViralRecipesRateLimitError extends Error {
  code = 'RATE_LIMIT';
}

export class ViralRecipesUpstreamError extends Error {
  code = 'UPSTREAM_ERROR';
}

const memoryCache = new Map<string, { payload: ViralRecipesFetchResult; expiresAt: number }>();

function cacheKey(category: ViralRecipesCategory): string {
  return category;
}

function readMemoryCache(category: ViralRecipesCategory): ViralRecipesFetchResult | null {
  const hit = memoryCache.get(cacheKey(category));
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    memoryCache.delete(cacheKey(category));
    return null;
  }
  return hit.payload;
}

function writeMemoryCache(category: ViralRecipesCategory, payload: ViralRecipesFetchResult): void {
  memoryCache.set(cacheKey(category), {
    payload,
    expiresAt: Date.now() + VIRAL_RECIPES.clientCacheTtlMs,
  });
}

async function parseError(response: Response, text: string): Promise<never> {
  let json: ViralRecipesErrorEnvelope = {};
  try {
    json = JSON.parse(text) as ViralRecipesErrorEnvelope;
  } catch {
    /* ignore */
  }
  const message = json.error ?? VIRAL_RECIPES_COPY.error;
  if (response.status === 503 || json.code === 'NOT_CONFIGURED') {
    throw new ViralRecipesNotConfiguredError(message);
  }
  if (response.status === 429 || json.code === 'RATE_LIMIT') {
    throw new ViralRecipesRateLimitError(message);
  }
  throw new ViralRecipesUpstreamError(message);
}

export async function fetchViralRecipes(
  category: ViralRecipesCategory,
  accessToken: string | null,
): Promise<ViralRecipesFetchResult> {
  if (isDemoMode()) {
    return {
      category,
      cached: true,
      items: demoViralRecipeItems(category),
    };
  }

  const cached = readMemoryCache(category);
  if (cached) return cached;

  const endpoint = getViralRecipesUrl();
  if (!endpoint) {
    throw new ViralRecipesNotConfiguredError('Viral recipes are not available on this app yet.');
  }

  const bearer = accessToken?.trim() || SUPABASE_ANON_KEY.trim();
  if (!bearer) {
    throw new ViralRecipesNotConfiguredError('Viral recipes are not available on this app yet.');
  }

  const response = await withTimeout(
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearer}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ category }),
    }),
    VIRAL_RECIPES.requestTimeoutMs,
    'Viral recipes request timed out',
  );

  const text = await response.text();
  if (!response.ok) {
    await parseError(response, text);
  }

  const json = JSON.parse(text) as ViralRecipesFetchResult;
  if (!Array.isArray(json.items)) {
    throw new ViralRecipesUpstreamError(VIRAL_RECIPES_COPY.error);
  }

  const result: ViralRecipesFetchResult = {
    category: json.category ?? category,
    cached: Boolean(json.cached),
    items: json.items,
  };
  writeMemoryCache(category, result);
  return result;
}
