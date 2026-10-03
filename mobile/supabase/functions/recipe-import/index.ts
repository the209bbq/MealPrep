// Recipe import from link — deploy folder recipe-import (Verify JWT ENABLED).
//
// Secrets: GEMINI_API_KEY (same as pantry-vision). Optional: GEMINI_MODEL, GEMINI_FALLBACK_MODELS.
// Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for recipe_import_cache.

import {
  canonicalYouTubeWatchUrl,
  classifyRecipeImportUrl,
  normalizeImportUrl,
  urlHashKey,
} from './urlClassification.ts';
import {
  extractRecipeFromPageText,
  extractRecipeFromYouTubeVideo,
} from './geminiRecipeExtract.ts';
import {
  findRecipeJsonLdInHtml,
  recipeJsonLdToExtracted,
  stripHtmlToText,
} from './jsonLdParser.ts';
import type { RecipeImportExtracted } from './recipeImportSchema.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const USER_WINDOW_MS = 60_000;
const USER_MAX_PER_WINDOW = 8;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const WEB_FETCH_TIMEOUT_MS = 12_000;
const WEB_MAX_BYTES = 1_500_000;
const WEB_MAX_TEXT_CHARS = 48_000;
const FETCH_USER_AGENT = 'MealPlanaticRecipeImport/1.0 (+https://mealplanatic.app; recipe-importer)';

const userHits = new Map<string, { count: number; windowStart: number }>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function checkUserRateLimit(userId: string): boolean {
  const now = Date.now();
  const bucket = userHits.get(userId);
  if (!bucket || now - bucket.windowStart > USER_WINDOW_MS) {
    userHits.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= USER_MAX_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}

function userIdFromJwt(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length);
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { sub?: string };
    return typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function readImportCache(
  urlKey: string,
): Promise<RecipeImportExtracted | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return null;

  const hash = await sha256Hex(urlKey);
  const query = `${supabaseUrl}/rest/v1/recipe_import_cache?url_hash=eq.${encodeURIComponent(hash)}&select=payload,expires_at`;
  const response = await fetch(query, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!response.ok) return null;
  const rows = (await response.json()) as Array<{ payload: RecipeImportExtracted; expires_at: string }>;
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row.payload;
}

async function writeImportCache(urlKey: string, sourceUrl: string, payload: RecipeImportExtracted): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return;

  const hash = await sha256Hex(urlKey);
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
  await fetch(`${supabaseUrl}/rest/v1/recipe_import_cache`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      url_hash: hash,
      source_url: sourceUrl,
      payload,
      expires_at: expiresAt,
    }),
  });
}

async function fetchRecipePage(url: string): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': FETCH_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(WEB_FETCH_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.length;
    if (total > WEB_MAX_BYTES) return null;
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(merged);
}

type ImportFromUrlResult =
  | { recipe: RecipeImportExtracted; cached: boolean }
  | { notRecipe: true; message: string }
  | null;

async function importFromUrl(
  apiKey: string,
  normalizedUrl: string,
  sourceType: 'youtube' | 'web',
): Promise<ImportFromUrlResult> {
  const cacheKey = urlHashKey(
    sourceType === 'youtube' ? canonicalYouTubeWatchUrl(normalizedUrl) : normalizedUrl,
  );
  const cached = await readImportCache(cacheKey);
  if (cached) return { recipe: { ...cached, source_url: normalizedUrl }, cached: true };

  if (sourceType === 'youtube') {
    const watchUrl = canonicalYouTubeWatchUrl(normalizedUrl);
    const extracted = await extractRecipeFromYouTubeVideo(apiKey, watchUrl, 'youtube', normalizedUrl);
    if (!extracted) return null;
    if (!extracted.is_recipe || extracted.confidence < 0.35) {
      return {
        notRecipe: true,
        message: 'That video does not look like a recipe. Try a cooking tutorial or a recipe blog link.',
      };
    }
    await writeImportCache(cacheKey, normalizedUrl, extracted);
    return { recipe: extracted, cached: false };
  }

  const html = await fetchRecipePage(normalizedUrl);
  if (!html) return null;

  const jsonLd = findRecipeJsonLdInHtml(html);
  if (jsonLd) {
    const fromLd = recipeJsonLdToExtracted(jsonLd, normalizedUrl);
    if (fromLd && fromLd.is_recipe && (fromLd.ingredients.length > 0 || fromLd.steps.length > 0)) {
      await writeImportCache(cacheKey, normalizedUrl, fromLd);
      return { recipe: fromLd, cached: false };
    }
  }

  const pageText = stripHtmlToText(html, WEB_MAX_TEXT_CHARS);
  const fromGemini = await extractRecipeFromPageText(apiKey, pageText, normalizedUrl);
  if (!fromGemini) return null;
  if (!fromGemini.is_recipe || fromGemini.confidence < 0.35) {
    return {
      notRecipe: true,
      message: 'We could not find a recipe on that page. Try a direct recipe link.',
    };
  }
  await writeImportCache(cacheKey, normalizedUrl, fromGemini);
  return { recipe: fromGemini, cached: false };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const userId = userIdFromJwt(req);
  if (!userId) {
    return jsonResponse({ error: 'Sign in required', code: 'UNAUTHENTICATED' }, 401);
  }

  if (!checkUserRateLimit(userId)) {
    return jsonResponse(
      { error: 'Too many recipe imports. Wait a minute and try again.', code: 'RATE_LIMIT' },
      429,
    );
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
  if (!apiKey) {
    return jsonResponse(
      { error: 'Recipe import is not set up yet. Ask an admin to finish setup.', code: 'NOT_CONFIGURED' },
      503,
    );
  }

  let body: { url?: string };
  try {
    body = (await req.json()) as { url?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400);
  }

  const normalized = normalizeImportUrl(body.url ?? '');
  if (!normalized) {
    return jsonResponse({ error: 'Invalid or missing URL', code: 'BAD_REQUEST' }, 400);
  }

  const sourceType = classifyRecipeImportUrl(normalized);
  if (!sourceType) {
    return jsonResponse({ error: 'Unsupported URL', code: 'BAD_REQUEST' }, 400);
  }

  try {
    const result = await importFromUrl(apiKey, normalized, sourceType);
    if (!result) {
      return jsonResponse(
        { error: 'Could not import that link right now. Try again shortly.', code: 'UPSTREAM_ERROR' },
        502,
      );
    }
    if ('notRecipe' in result && result.notRecipe) {
      return jsonResponse({ error: result.message, code: 'NOT_RECIPE' }, 422);
    }
    return jsonResponse({ recipe: result.recipe, cached: result.cached });
  } catch (error) {
    console.error('recipe-import error', error);
    return jsonResponse(
      { error: 'Import failed unexpectedly.', code: 'UPSTREAM_ERROR' },
      502,
    );
  }
});
