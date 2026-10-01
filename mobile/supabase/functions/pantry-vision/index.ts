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
const GEMINI_PRIMARY_MODEL_ATTEMPTS = 3;
const GEMINI_RETRYABLE_HTTP_STATUSES = new Set([429, 500, 503]);
const PANTRY_VISION_CACHE_VERSION = 'v3';
const PANTRY_MAX_ITEMS = 120;
const GEMINI_DETERMINISTIC_SEED = 42;
const GEMINI_MAX_OUTPUT_TOKENS = 16_384;
const GEMINI_MAX_OUTPUT_TOKENS_RETRY = 24_576;

const SCAN_RESULT_CACHE_TTL_MS = 30 * 60 * 1000;
const SCAN_RESULT_CACHE_MAX = 200;
const scanResultCache = new Map<string, { at: number; items: DetectedPantryItem[]; model: string }>();

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

const PRICE_TAG_JSON_SCHEMA = {
  type: 'object',
  properties: {
    itemName: { type: 'string' },
    price: { type: 'number' },
    sizeUnit: { type: 'string' },
    saleValidUntil: { type: ['string', 'null'] },
  },
  required: ['itemName', 'price'],
} as const;

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

async function userHasPlusPhotoScanAccess(userId: string): Promise<boolean> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    console.error('pantry-vision: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for plan check');
    return false;
  }

  const url = `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=plan,role`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
  } catch (error) {
    console.warn('pantry-vision: plan lookup network error', error);
    return false;
  }

  if (!response.ok) {
    console.warn(`pantry-vision: plan lookup http ${response.status}`);
    return false;
  }

  try {
    const rows = (await response.json()) as Array<{ plan?: string; role?: string }>;
    const row = rows[0];
    if (!row) return false;
    if (row.role === 'admin') return true;
    return row.plan === 'paid';
  } catch (error) {
    console.warn('pantry-vision: plan lookup parse error', error);
    return false;
  }
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

type VisionAction = 'pantry' | 'price-tag';

type ImageFromRequest = {
  bytes: Uint8Array;
  mimeType: string;
  scanLocation: (typeof PANTRY_STORAGE)[number];
  action: VisionAction;
  imageHash?: string;
};

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

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
    const actionField = form.get('action');
    const action: VisionAction = actionField === 'price-tag' ? 'price-tag' : 'pantry';
    const hashField = form.get('imageHash');
    const imageHash = typeof hashField === 'string' ? hashField.trim() : undefined;
    return { bytes: buffer, mimeType, scanLocation, action, imageHash };
  }

  let body: {
    imageBase64?: string;
    mimeType?: string;
    location?: string;
    action?: string;
    imageHash?: string;
  };
  try {
    body = (await req.json()) as {
      imageBase64?: string;
      mimeType?: string;
      location?: string;
      action?: string;
      imageHash?: string;
    };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400);
  }

  const scanLocation = parseScanLocationHint(body.location);
  const action: VisionAction = body.action === 'price-tag' ? 'price-tag' : 'pantry';
  const imageHash = typeof body.imageHash === 'string' ? body.imageHash.trim() : undefined;

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
    return { bytes, mimeType, scanLocation, action, imageHash };
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

function normalizeNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stableSortItems(items: DetectedPantryItem[]): DetectedPantryItem[] {
  return [...items].sort((a, b) => normalizeNameKey(a.name).localeCompare(normalizeNameKey(b.name)));
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
  return stableSortItems(out).slice(0, PANTRY_MAX_ITEMS);
}

function dedupeItems(items: DetectedPantryItem[]): DetectedPantryItem[] {
  const merged: DetectedPantryItem[] = [];
  for (const row of stableSortItems(items)) {
    const key = normalizeNameKey(row.name);
    const existingIndex = merged.findIndex((m) => normalizeNameKey(m.name) === key);
    if (existingIndex < 0) {
      merged.push(row);
      continue;
    }
    const existing = merged[existingIndex];
    const sameUnit = existing.unit.toLowerCase() === row.unit.toLowerCase();
    merged[existingIndex] = {
      ...existing,
      quantity: sameUnit ? existing.quantity + row.quantity : Math.max(existing.quantity, row.quantity),
      confidence: Math.max(existing.confidence, row.confidence),
    };
  }
  return stableSortItems(merged);
}

function mergeItemPasses(passA: DetectedPantryItem[], passB: DetectedPantryItem[]): DetectedPantryItem[] {
  return dedupeItems([...passA, ...passB]);
}

function getCachedScan(cacheKey: string): { items: DetectedPantryItem[]; model: string } | null {
  const entry = scanResultCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.at > SCAN_RESULT_CACHE_TTL_MS) {
    scanResultCache.delete(cacheKey);
    return null;
  }
  return { items: entry.items, model: entry.model };
}

function setCachedScan(cacheKey: string, items: DetectedPantryItem[], model: string): void {
  if (scanResultCache.size >= SCAN_RESULT_CACHE_MAX) {
    const oldest = [...scanResultCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) scanResultCache.delete(oldest[0]);
  }
  scanResultCache.set(cacheKey, { at: Date.now(), items, model });
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

function priceTagPrompt(): string {
  return (
    'You read grocery store shelf tags and price labels from a photo. ' +
    'Extract the product name, the shelf price in US dollars (number only, no $), the package size or unit (e.g. "16 oz", "1 gal", "each"), ' +
    'and an optional sale end date in YYYY-MM-DD if a sale or "valid through" date is visible. ' +
    'If no sale date is shown, set saleValidUntil to null. Do not invent prices that are not visible. Return JSON only.'
  );
}

type SanitizedPriceTag = {
  itemName: string;
  price: number;
  sizeUnit?: string;
  saleValidUntil?: string | null;
};

function sanitizePriceTag(raw: unknown): SanitizedPriceTag | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const itemName = typeof row.itemName === 'string' ? row.itemName.trim() : '';
  const price = Number(row.price);
  if (!itemName || !Number.isFinite(price) || price < 0) return null;
  const sizeUnit =
    typeof row.sizeUnit === 'string' && row.sizeUnit.trim() ? row.sizeUnit.trim().slice(0, 48) : undefined;
  let saleValidUntil: string | null | undefined = undefined;
  if (row.saleValidUntil === null) saleValidUntil = null;
  else if (typeof row.saleValidUntil === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.saleValidUntil.trim())) {
    saleValidUntil = row.saleValidUntil.trim();
  }
  return {
    itemName: itemName.slice(0, 120),
    price: Math.round(price * 100) / 100,
    sizeUnit,
    saleValidUntil,
  };
}

function geminiEnumeratePrompt(scanLocation: (typeof PANTRY_STORAGE)[number]): string {
  return (
    'You inventory kitchen storage from a photo. Do NOT summarize, group, or skip items to be brief.\n' +
    scanLocationPromptHint(scanLocation) +
    '\nProcess systematically: scan shelf by shelf top-to-bottom; on each shelf go left-to-right.\n' +
    'List EVERY distinct product visible, including partially visible items when the label is readable.\n' +
    'One JSON object per distinct product. If three identical cans are visible, use quantity 3 and unit "can".\n' +
    'Use realistic units (oz, lb, each, bottle, jar, can). Set confidence 0-1. Do not invent unreadable items.\n' +
    'Example item: {"name":"Campbell\'s tomato soup","quantity":2,"unit":"can","category":"dry_goods","storage":"pantry","confidence":0.91}\n' +
    'Return JSON only matching the schema.'
  );
}

function geminiVerifyPrompt(scanLocation: (typeof PANTRY_STORAGE)[number], passOneNames: string[]): string {
  const list = passOneNames.slice(0, 80).map((n) => `- ${n}`).join('\n');
  return (
    'You verify a pantry inventory from the same photo.\n' +
    scanLocationPromptHint(scanLocation) +
    '\nFirst pass found:\n' +
    list +
    '\nLook at the image again. ADD any visible products missing from that list. Merge duplicates.\n' +
    'Keep correct first-pass items. Do not summarize. Return the FULL merged list in JSON only.'
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

type GeminiVisionRequest = {
  prompt: string;
  schema: Record<string, unknown>;
  maxOutputTokens: number;
};

type GeminiCallSuccess = {
  text: string;
  finishReason?: string;
};

async function callGeminiOnce(
  apiKey: string,
  model: string,
  mimeType: string,
  imageBase64: string,
  vision: GeminiVisionRequest,
): Promise<GeminiCallSuccess | { error: GeminiAttemptError }> {
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const payload = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
          { text: vision.prompt },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: vision.schema,
      temperature: 0,
      topP: 0.1,
      seed: GEMINI_DETERMINISTIC_SEED,
      maxOutputTokens: vision.maxOutputTokens,
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
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    };
    const candidate = envelope.candidates?.[0];
    const partText = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    const finishReason = candidate?.finishReason;
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
    return { text: partText, finishReason };
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

async function callPantryGeminiPass(
  apiKey: string,
  model: string,
  mimeType: string,
  imageBase64: string,
  prompt: string,
  maxOutputTokens: number,
): Promise<{ items: DetectedPantryItem[] } | { error: GeminiAttemptError }> {
  const result = await callGeminiOnce(apiKey, model, mimeType, imageBase64, {
    prompt,
    schema: RESPONSE_JSON_SCHEMA,
    maxOutputTokens,
  });
  if ('error' in result) return result;

  if (result.finishReason === 'MAX_TOKENS') {
    const retry = await callGeminiOnce(apiKey, model, mimeType, imageBase64, {
      prompt,
      schema: RESPONSE_JSON_SCHEMA,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS_RETRY,
    });
    if ('error' in retry) return retry;
    try {
      const parsed = JSON.parse(retry.text) as unknown;
      const items = sanitizeItems(parsed);
      if (items.length === 0) {
        return {
          error: {
            kind: 'http',
            status: 502,
            detail: 'Model output truncated (MAX_TOKENS)',
            retryable: true,
          },
        };
      }
      return { items };
    } catch {
      return {
        error: {
          kind: 'http',
          status: 502,
          detail: 'Truncated JSON after MAX_TOKENS retry',
          retryable: true,
        },
      };
    }
  }

  try {
    const parsed = JSON.parse(result.text) as unknown;
    const items = sanitizeItems(parsed);
    if (items.length === 0) {
      return {
        error: {
          kind: 'http',
          status: 502,
          detail: 'Empty or invalid pantry JSON',
          retryable: true,
        },
      };
    }
    return { items };
  } catch {
    return {
      error: {
        kind: 'http',
        status: 502,
        detail: 'Failed to parse pantry JSON',
        retryable: true,
      },
    };
  }
}

async function callPantryGeminiTwoPass(
  apiKey: string,
  model: string,
  mimeType: string,
  imageBase64: string,
  scanLocation: (typeof PANTRY_STORAGE)[number],
): Promise<{ items: DetectedPantryItem[] } | { error: GeminiAttemptError }> {
  const passOne = await callPantryGeminiPass(
    apiKey,
    model,
    mimeType,
    imageBase64,
    geminiEnumeratePrompt(scanLocation),
    GEMINI_MAX_OUTPUT_TOKENS,
  );
  if ('error' in passOne) return passOne;

  const passTwo = await callPantryGeminiPass(
    apiKey,
    model,
    mimeType,
    imageBase64,
    geminiVerifyPrompt(scanLocation, passOne.items.map((i) => i.name)),
    GEMINI_MAX_OUTPUT_TOKENS,
  );
  if ('error' in passTwo) {
    return passOne;
  }

  return { items: mergeItemPasses(passOne.items, passTwo.items) };
}

async function callPriceTagGeminiOnce(
  apiKey: string,
  model: string,
  mimeType: string,
  imageBase64: string,
): Promise<{ tag: SanitizedPriceTag } | { error: GeminiAttemptError }> {
  const result = await callGeminiOnce(apiKey, model, mimeType, imageBase64, {
    prompt: priceTagPrompt(),
    schema: PRICE_TAG_JSON_SCHEMA,
    maxOutputTokens: 1024,
  });
  if ('error' in result) return result;
  try {
    const parsed = JSON.parse(result.text) as unknown;
    const tag = sanitizePriceTag(parsed);
    if (!tag) {
      return {
        error: {
          kind: 'http',
          status: 502,
          detail: 'Could not read a price from the tag',
          retryable: true,
        },
      };
    }
    return { tag };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse price tag response';
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

async function callPantryGeminiOnModelWithRetries(
  apiKey: string,
  model: string,
  mimeType: string,
  imageBase64: string,
  scanLocation: (typeof PANTRY_STORAGE)[number],
): Promise<{ items: DetectedPantryItem[] } | { error: GeminiAttemptError }> {
  let lastError: GeminiAttemptError | null = null;
  for (let attempt = 0; attempt < GEMINI_PRIMARY_MODEL_ATTEMPTS; attempt += 1) {
    const result = await callPantryGeminiTwoPass(apiKey, model, mimeType, imageBase64, scanLocation);
    if ('items' in result) return result;
    lastError = result.error;
    const shouldRetry =
      result.error.kind === 'timeout' ||
      (result.error.kind === 'http' && result.error.retryable);
    if (!shouldRetry) return result;
    await sleep(GEMINI_RETRY_BACKOFF_MS * (attempt + 1));
  }
  return lastError
    ? { error: lastError }
    : { error: { kind: 'http', status: 502, detail: 'Unknown failure', retryable: true } };
}

async function callPriceTagGeminiWithSingleRetry(
  apiKey: string,
  model: string,
  mimeType: string,
  imageBase64: string,
): Promise<{ tag: SanitizedPriceTag } | { error: GeminiAttemptError }> {
  let result = await callPriceTagGeminiOnce(apiKey, model, mimeType, imageBase64);
  if ('tag' in result) return result;

  const shouldRetry =
    result.error.kind === 'timeout' ||
    (result.error.kind === 'http' && result.error.retryable);

  if (!shouldRetry) return result;

  await sleep(GEMINI_RETRY_BACKOFF_MS);
  result = await callPriceTagGeminiOnce(apiKey, model, mimeType, imageBase64);
  return result;
}

async function callPantryGeminiWithFallbacks(
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
    const result = await callPantryGeminiOnModelWithRetries(
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

async function callPriceTagGeminiWithFallbacks(
  apiKey: string,
  mimeType: string,
  imageBase64: string,
): Promise<{ tag: SanitizedPriceTag; model: string }> {
  const candidates = buildGeminiModelCandidates(
    Deno.env.get('GEMINI_MODEL') ?? undefined,
    Deno.env.get('GEMINI_FALLBACK_MODELS') ?? undefined,
  );

  const failures: string[] = [];

  for (const model of candidates) {
    const result = await callPriceTagGeminiWithSingleRetry(apiKey, model, mimeType, imageBase64);
    if ('tag' in result) {
      console.log(`pantry-vision: price-tag ok model=${model} item=${result.tag.itemName}`);
      return { tag: result.tag, model };
    }
    failures.push(formatAttemptError(model, result.error));
    console.warn(`pantry-vision: price-tag failed ${failures[failures.length - 1]}`);
  }

  const summary = failures.slice(-4).join(' | ');
  throw new Error(
    `Could not read the shelf tag after trying ${candidates.length} model(s). ${summary}`,
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

  const planAllowed = await userHasPlusPhotoScanAccess(userId);
  if (!planAllowed) {
    return jsonResponse(
      {
        error: 'Photo scanning requires MealPlanatic Plus.',
        code: 'PLAN_REQUIRED',
      },
      403,
    );
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
    const contentHash = imageResult.imageHash || (await sha256Hex(imageResult.bytes));
    const cacheKey = `${PANTRY_VISION_CACHE_VERSION}|${imageResult.scanLocation}|${contentHash}`;

    if (imageResult.action === 'price-tag') {
      const { tag, model } = await callPriceTagGeminiWithFallbacks(
        apiKey,
        imageResult.mimeType,
        imageBase64,
      );
      return jsonResponse(
        {
          itemName: tag.itemName,
          price: tag.price,
          sizeUnit: tag.sizeUnit ?? null,
          saleValidUntil: tag.saleValidUntil ?? null,
          model,
        },
        200,
      );
    }

    const cached = getCachedScan(cacheKey);
    if (cached) {
      return jsonResponse(
        {
          items: cached.items,
          model: cached.model,
          scanLocation: imageResult.scanLocation,
          cached: true,
          itemCount: cached.items.length,
        },
        200,
      );
    }

    const { items, model } = await callPantryGeminiWithFallbacks(
      apiKey,
      imageResult.mimeType,
      imageBase64,
      imageResult.scanLocation,
    );

    setCachedScan(cacheKey, items, model);

    return jsonResponse(
      { items, model, scanLocation: imageResult.scanLocation, cached: false, itemCount: items.length },
      200,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pantry vision error';
    return jsonResponse({ error: message, code: 'UPSTREAM_ERROR' }, 502);
  }
});
