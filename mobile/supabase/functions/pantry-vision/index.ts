// Pantry shelf vision — paste this ENTIRE file into Supabase Dashboard:
// Edge Functions → Deploy a new function → Via Editor → name: pantry-vision
//
// Settings: leave "Verify JWT" ENABLED (default). Anonymous calls are rejected at the gateway;
// this handler reads the user id from the JWT for rate limiting.
//
// Secrets (Edge Functions → Secrets):
//   GEMINI_API_KEY = key from https://aistudio.google.com/apikey
// Optional secret:
//   GEMINI_MODEL = e.g. gemini-2.5-flash (defaults below)

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

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
          confidence: { type: 'number' },
        },
        required: ['name', 'quantity', 'unit', 'category', 'confidence'],
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

async function readImageFromRequest(req: Request): Promise<{ bytes: Uint8Array; mimeType: string } | Response> {
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
    return { bytes: buffer, mimeType };
  }

  let body: { imageBase64?: string; mimeType?: string };
  try {
    body = (await req.json()) as { imageBase64?: string; mimeType?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400);
  }

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
    return { bytes, mimeType };
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
    out.push({
      name: name.slice(0, 120),
      quantity: Number.isFinite(quantity) && quantity > 0 ? Math.min(quantity, 9999) : 1,
      unit: unit.slice(0, 32),
      category,
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
    });
  }
  return out.slice(0, 40);
}

async function callGemini(
  apiKey: string,
  model: string,
  mimeType: string,
  imageBase64: string,
): Promise<DetectedPantryItem[]> {
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const prompt =
    'You analyze photos of pantry shelves, refrigerators, or kitchen storage. ' +
    'List distinct food or kitchen items visible. Use realistic quantities and units (oz, lb, cups, each, bottle, jar). ' +
    'Pick the best pantry category for each item. Set confidence between 0 and 1. ' +
    'Do not invent items that are not visible. Return JSON only.';

  const payload = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: RESPONSE_JSON_SCHEMA,
      temperature: 0.2,
    },
  };

  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await upstream.text();
  if (!upstream.ok) {
    let detail = text.slice(0, 240);
    try {
      const errJson = JSON.parse(text) as { error?: { message?: string } };
      detail = errJson.error?.message ?? detail;
    } catch {
      /* keep raw snippet */
    }
    throw new Error(`Gemini request failed (${upstream.status}): ${detail}`);
  }

  let parsed: unknown;
  try {
    const envelope = JSON.parse(text) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const partText = envelope.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!partText) throw new Error('Empty model response');
    parsed = JSON.parse(partText);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse Gemini response';
    throw new Error(message);
  }

  return sanitizeItems(parsed);
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

  const model = (Deno.env.get('GEMINI_MODEL') ?? DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL;

  try {
    const imageResult = await readImageFromRequest(req);
    if (imageResult instanceof Response) return imageResult;

    const imageBase64 = bytesToBase64(imageResult.bytes);
    const items = await callGemini(apiKey, model, imageResult.mimeType, imageBase64);

    return jsonResponse({ items, model }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pantry vision error';
    return jsonResponse({ error: message, code: 'UPSTREAM_ERROR' }, 502);
  }
});
