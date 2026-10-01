// Pantry shelf vision — paste this ENTIRE file into Supabase Dashboard:
// Edge Functions → pantry-vision → Via Editor
//
// Settings: leave "Verify JWT" ENABLED (default). Anonymous calls are rejected at the gateway;
// this handler reads the user id from the JWT for rate limiting.
//
// Secrets (Edge Functions → Secrets):
//   GEMINI_API_KEY = key from https://aistudio.google.com/apikey
// Optional secrets:
//   GEMINI_MODEL = e.g. gemini-3.6-flash (defaults below; keep in sync with mobile/config/geminiVision.ts)
//   GEMINI_FALLBACK_MODELS = comma-separated backup model ids (optional)

/** @sync mobile/config/geminiVision.ts */
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
const DEFAULT_GEMINI_FALLBACK_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
] as const;
const GEMINI_REQUEST_TIMEOUT_MS = 90_000;
const GEMINI_RETRY_BACKOFF_MS = 450;
const GEMINI_RETRYABLE_HTTP_STATUSES = new Set([429, 500, 503]);

function parseCommaSeparatedModels(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function buildGeminiModelCandidates(
  primaryFromEnv: string | undefined,
  fallbacksFromEnv: string | undefined,
): string[] {
  const primary =
    (primaryFromEnv ?? DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL;
  const fromSecret = parseCommaSeparatedModels(fallbacksFromEnv);
  const ordered = [primary, ...fromSecret, ...DEFAULT_GEMINI_FALLBACK_MODELS];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const model of ordered) {
    if (seen.has(model)) continue;
    seen.add(model);
    out.push(model);
  }
  return out;
}

function isModelNotFoundOrRetired(status: number, detail: string): boolean {
  if (status !== 404) return false;
  const lower = detail.toLowerCase();
  return (
    lower.includes('not found') ||
    lower.includes('not_found') ||
    lower.includes('retired') ||
    lower.includes('no longer') ||
    lower.includes('does not exist')
  );
}

function isRetryableGeminiHttpFailure(status: number, detail: string): boolean {
  return GEMINI_RETRYABLE_HTTP_STATUSES.has(status) || isModelNotFoundOrRetired(status, detail);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const PANTRY_CATEGORIES = [
  'spices',
  'meats',
  'produce',
  'dairy',
  'dry_goods',
  'cookware',
  'frozen',
  'condiments',
] as const;

const PANTRY_STORAGE = ['pantry', 'fridge', 'spice_rack'] as const;

const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string' },
          category: { type: 'string', enum: [...PANTRY_CATEGORIES] },
          storage: { type: 'string', enum: [...PANTRY_STORAGE] },
          confidence: { type: 'number' },
        },
        required: ['name', 'quantity', 'unit', 'category', 'storage', 'confidence'],
      },
    },
  },
  required: ['items'],
} as const;

const userHits = new Map<string, { count: number; windowStart: number }>();
const USER_WINDOW_MS = 60_000;
const USER_MAX_PER_WINDOW = 12;

type DetectedPantryItem = {
  name: string;
  quantity: number;
  unit: string;
  category: (typeof PANTRY_CATEGORIES)[number];
  storage: (typeof PANTRY_STORAGE)[number];
  confidence: number;
};

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

/** With Verify JWT enabled, only authenticated requests reach this handler. */
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

function estimateBase64Bytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function normalizeMime(value: string | null | undefined): string {
  const mime = (value ?? 'image/jpeg').toLowerCase().split(';')[0].trim();
  return mime === 'image/jpg' ? 'image/jpeg' : mime;
}

function parseScanLocationHint(raw: unknown): (typeof PANTRY_STORAGE)[number] {
  if (typeof raw !== 'string') return 'pantry';
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, '_');
  if (trimmed === 'spice_rack' || trimmed === 'spice-rack' || trimmed === 'spicerack') return 'spice_rack';
  if ((PANTRY_STORAGE as readonly string[]).includes(trimmed)) {
    return trimmed as (typeof PANTRY_STORAGE)[number];
  }
  return 'pantry';
}

type ImageFromRequest = {
  bytes: Uint8Array;
  mimeType: string;
  scanLocation: (typeof PANTRY_STORAGE)[number];
};

async function readImageFromRequest(req: Request): Promise<ImageFromRequest | Response> {
  const contentType = req.headers.get('Content-Type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('image');
    if (!(file instanceof File)) {
      return jsonResponse({ error: 'Missing image file field "image"', code: 'BAD_REQUEST' }, 400);
    }
    const mimeType = normalizeMime(file.type);
    if (!ALLOWED_MIME.has(mimeType)) {
      return jsonResponse({ error: 'Unsupported image type. Use JPEG, PNG, or WebP.', code: 'BAD_REQUEST' }, 400);
    }
    const buffer = new Uint8Array(await file.arrayBuffer());
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return jsonResponse({ error: 'Image too large. Resize on the client and try again.', code: 'PAYLOAD_TOO_LARGE' }, 413);
    }
    const locationField = form.get('location');
    const scanLocation = parseScanLocationHint(
      typeof locationField === 'string' ? locationField : undefined,
    );
    return { bytes: buffer, mimeType, scanLocation };
  }

  let body: { imageBase64?: string; mimeType?: string; location?: string };
  try {
    body = (await req.json()) as { imageBase64?: string; mimeType?: string; location?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400);
  }

  const scanLocation = parseScanLocationHint(body.location);

  const raw = body.imageBase64?.trim() ?? '';
  if (!raw) {
    return jsonResponse({ error: 'imageBase64 is required', code: 'BAD_REQUEST' }, 400);
  }
  const mimeType = normalizeMime(body.mimeType);
  if (!ALLOWED_MIME.has(mimeType)) {
    return jsonResponse({ error: 'Unsupported mimeType', code: 'BAD_REQUEST' }, 400);
  }

  const base64 = raw.includes(',') ? (raw.split(',').pop() ?? '') : raw;
  if (estimateBase64Bytes(base64) > MAX_IMAGE_BYTES) {
    return jsonResponse({ error: 'Image too large. Resize on the client and try again.', code: 'PAYLOAD_TOO_LARGE' }, 413);
  }

  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { bytes, mimeType, scanLocation };
  } catch {
    return jsonResponse({ error: 'Invalid base64 image data', code: 'BAD_REQUEST' }, 400);
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sanitizeItems(raw: unknown): DetectedPantryItem[] {
  if (!raw || typeof raw !== 'object') return [];
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];

  const out: DetectedPantryItem[] = [];
  for (const entry of items) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!name) continue;
    const quantity = Number(row.quantity);
    const unit = typeof row.unit === 'string' ? row.unit.trim() || 'each' : 'each';
    const categoryRaw = typeof row.category === 'string' ? row.category : 'dry_goods';
    const category = (PANTRY_CATEGORIES as readonly string[]).includes(categoryRaw)
      ? (categoryRaw as (typeof PANTRY_CATEGORIES)[number])
      : 'dry_goods';
    const confidence = Number(row.confidence);
    const storageRaw = typeof row.storage === 'string' ? row.storage.trim().toLowerCase() : 'pantry';
    const storage = (PANTRY_STORAGE as readonly string[]).includes(storageRaw)
      ? (storageRaw as (typeof PANTRY_STORAGE)[number])
      : 'pantry';
    out.push({
      name: name.slice(0, 120),
      quantity: Number.isFinite(quantity) && quantity > 0 ? Math.min(quantity, 9999) : 1,
      unit: unit.slice(0, 32),
      category,
      storage,
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
    });
  }
  return out.slice(0, 40);
}

function scanLocationPromptHint(scanLocation: (typeof PANTRY_STORAGE)[number]): string {
  switch (scanLocation) {
    case 'fridge':
      return (
        'The user is scanning their refrigerator. Expect chilled items: dairy, eggs, fresh meat and fish, produce, ' +
        'opened condiments, and leftovers. Still assign correct storage if something shelf-stable appears.'
      );
    case 'spice_rack':
      return (
        'The user is scanning their spice rack. Expect dried spices, dried herbs, and seasonings. ' +
        'Still assign correct storage if a non-spice item appears.'
      );
    default:
      return (
        'The user is scanning pantry shelves. Expect dry goods, canned goods, snacks, cereal, baking supplies, ' +
        'shelf-stable sauces, bread, and similar room-temperature items. Still assign correct storage for perishables if visible.'
      );
  }
}

type GeminiAttemptFailure = {
  kind: 'http';
  status: number;
  detail: string;
  retryable: boolean;
};

type GeminiAttemptTimeout = {
  kind: 'timeout';
  retryable: true;
};

type GeminiAttemptError = GeminiAttemptFailure | GeminiAttemptTimeout;

function geminiPrompt(scanLocation: (typeof PANTRY_STORAGE)[number]): string {
  return (
    'You analyze photos of pantry shelves, refrigerators, or kitchen storage. ' +
    scanLocationPromptHint(scanLocation) +
    ' List distinct food or kitchen items visible. Use realistic quantities and units (oz, lb, cups, each, bottle, jar). ' +
    'Pick the best pantry category for each item. ' +
    'For each item set storage to exactly one of: pantry, fridge, spice_rack. ' +
    'Put dried spices, dried herbs, and seasonings (e.g. garlic powder, cumin, paprika) in spice_rack. ' +
    'Put dairy, eggs, fresh meat and fish, most fresh produce, opened condiments that need refrigeration, and leftovers in fridge. ' +
    'Put dry goods, canned goods, snacks, cereal, baking supplies, shelf-stable sauces and dressings (unopened), syrup, peanut butter, and bread in pantry. ' +
    'Set confidence between 0 and 1. Do not invent items that are not visible. Return JSON only.'
  );
}

function parseGeminiErrorDetail(status: number, text: string): { detail: string; retryable: boolean } {
  let detail = text.slice(0, 320);
  try {
    const errJson = JSON.parse(text) as { error?: { message?: string } };
    detail = errJson.error?.message ?? detail;
  } catch {
    /* keep raw snippet */
  }
  return { detail, retryable: isRetryableGeminiHttpFailure(status, detail) };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGeminiOnce(
  apiKey: string,
  model: string,
  mimeType: string,
  imageBase64: string,
  scanLocation: (typeof PANTRY_STORAGE)[number],
): Promise<{ items: DetectedPantryItem[] } | { error: GeminiAttemptError }> {
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const payload = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
          { text: geminiPrompt(scanLocation) },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: RESPONSE_JSON_SCHEMA,
      temperature: 0.2,
    },
  };

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(GEMINI_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const isTimeout =
      error instanceof DOMException
        ? error.name === 'TimeoutError'
        : error instanceof Error && error.name === 'TimeoutError';
    if (isTimeout) {
      return { error: { kind: 'timeout', retryable: true } };
    }
    const message = error instanceof Error ? error.message : 'Network error calling Gemini';
    return {
      error: {
        kind: 'http',
        status: 0,
        detail: message,
        retryable: false,
      },
    };
  }

  const text = await upstream.text();
  if (!upstream.ok) {
    const parsed = parseGeminiErrorDetail(upstream.status, text);
    return {
      error: {
        kind: 'http',
        status: upstream.status,
        detail: parsed.detail,
        retryable: parsed.retryable,
      },
    };
  }

  try {
    const envelope = JSON.parse(text) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const partText = envelope.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!partText) {
      return {
        error: {
          kind: 'http',
          status: 502,
          detail: 'Empty model response',
          retryable: true,
        },
      };
    }
    const parsed = JSON.parse(partText) as unknown;
    return { items: sanitizeItems(parsed) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse Gemini response';
    return {
      error: {
        kind: 'http',
        status: 502,
        detail: message,
        retryable: false,
      },
    };
  }
}

function formatAttemptError(model: string, error: GeminiAttemptError): string {
  if (error.kind === 'timeout') {
    return `${model}: timed out after ${GEMINI_REQUEST_TIMEOUT_MS}ms`;
  }
  const statusLabel = error.status > 0 ? String(error.status) : 'network';
  return `${model} (${statusLabel}): ${error.detail}`;
}

async function callGeminiWithSingleRetry(
  apiKey: string,
  model: string,
  mimeType: string,
  imageBase64: string,
  scanLocation: (typeof PANTRY_STORAGE)[number],
): Promise<{ items: DetectedPantryItem[] } | { error: GeminiAttemptError }> {
  let result = await callGeminiOnce(apiKey, model, mimeType, imageBase64, scanLocation);
  if ('items' in result) return result;

  const shouldRetry =
    result.error.kind === 'timeout' ||
    (result.error.kind === 'http' && result.error.retryable);

  if (!shouldRetry) return result;

  await sleep(GEMINI_RETRY_BACKOFF_MS);
  result = await callGeminiOnce(apiKey, model, mimeType, imageBase64, scanLocation);
  return result;
}

async function callGeminiWithFallbacks(
  apiKey: string,
  mimeType: string,
  imageBase64: string,
  scanLocation: (typeof PANTRY_STORAGE)[number],
): Promise<{ items: DetectedPantryItem[]; model: string }> {
  const candidates = buildGeminiModelCandidates(
    Deno.env.get('GEMINI_MODEL') ?? undefined,
    Deno.env.get('GEMINI_FALLBACK_MODELS') ?? undefined,
  );

  const failures: string[] = [];

  for (const model of candidates) {
    const result = await callGeminiWithSingleRetry(
      apiKey,
      model,
      mimeType,
      imageBase64,
      scanLocation,
    );
    if ('items' in result) {
      console.log(`pantry-vision: gemini ok model=${model} items=${result.items.length}`);
      return { items: result.items, model };
    }
    failures.push(formatAttemptError(model, result.error));
    console.warn(`pantry-vision: gemini failed ${failures[failures.length - 1]}`);
  }

  const summary = failures.slice(-4).join(' | ');
  throw new Error(
    `Pantry scan could not reach Gemini after trying ${candidates.length} model(s). ${summary}`,
  );
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
      {
        error: 'Too many pantry scans. Wait a minute and try again.',
        code: 'RATE_LIMIT',
      },
      429,
    );
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
  if (!apiKey) {
    return jsonResponse(
      {
        error:
          'Pantry photo scan is not set up yet. Add GEMINI_API_KEY in Supabase Edge Function secrets and redeploy.',
        code: 'NOT_CONFIGURED',
      },
      503,
    );
  }

  try {
    const imageResult = await readImageFromRequest(req);
    if (imageResult instanceof Response) return imageResult;

    const imageBase64 = bytesToBase64(imageResult.bytes);
    const { items, model } = await callGeminiWithFallbacks(
      apiKey,
      imageResult.mimeType,
      imageBase64,
      imageResult.scanLocation,
    );

    return jsonResponse({ items, model, scanLocation: imageResult.scanLocation }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pantry vision error';
    return jsonResponse({ error: message, code: 'UPSTREAM_ERROR' }, 502);
  }
});
