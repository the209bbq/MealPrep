// AUTO-GENERATED single-file bundle for pasting into the Supabase dashboard. Source: supabase/functions/pantry-vision/
// supabase/functions/pantry-vision/index.ts
var DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
var DEFAULT_GEMINI_FALLBACK_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash"
];
var DEFAULT_GEMINI_REQUEST_TIMEOUT_MS = 38e3;
var GEMINI_REQUEST_TIMEOUT_MS = DEFAULT_GEMINI_REQUEST_TIMEOUT_MS;
var LARGE_PANTRY_IMAGE_BASE64_LENGTH = 24e5;
function parseGeminiRequestTimeoutMs(raw) {
  if (!raw?.trim()) return DEFAULT_GEMINI_REQUEST_TIMEOUT_MS;
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 8e3 || parsed > 12e4) {
    return DEFAULT_GEMINI_REQUEST_TIMEOUT_MS;
  }
  return parsed;
}
function isLargePantryImageBase64(imageBase64) {
  return imageBase64.length >= LARGE_PANTRY_IMAGE_BASE64_LENGTH;
}
var GEMINI_REQUEST_TOTAL_BUDGET_MS = 11e4;
var GEMINI_MIN_PER_CALL_TIMEOUT_MS = 2500;
var MODEL_TIMEOUT_DEPRIORITIZE_MS = 5 * 60 * 1e3;
var GEMINI_HTTP_RETRIES_PER_MODEL = 2;
function parseCommaSeparatedModels(raw) {
  if (!raw?.trim()) return [];
  return raw.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
}
function buildGeminiModelCandidates(primaryFromEnv, fallbacksFromEnv) {
  const primary = (primaryFromEnv ?? DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL;
  const fromSecret = parseCommaSeparatedModels(fallbacksFromEnv);
  const ordered = [primary, ...fromSecret, ...DEFAULT_GEMINI_FALLBACK_MODELS];
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const model of ordered) {
    if (seen.has(model)) continue;
    seen.add(model);
    out.push(model);
  }
  return out;
}
function deprioritizeRecentlyTimedOutModels(candidates, timedOutAt, nowMs, ttlMs = MODEL_TIMEOUT_DEPRIORITIZE_MS, skipLargeImageTimeouts = null, imageIsLarge = false) {
  let pool = candidates;
  if (imageIsLarge && skipLargeImageTimeouts && skipLargeImageTimeouts.size > 0) {
    const filtered = candidates.filter((model) => {
      const at = skipLargeImageTimeouts.get(model);
      return at == null || nowMs - at >= ttlMs;
    });
    if (filtered.length > 0) pool = filtered;
  }
  const fresh = [];
  const deprioritized = [];
  for (const model of pool) {
    const at = timedOutAt.get(model);
    if (at != null && nowMs - at < ttlMs) {
      deprioritized.push(model);
    } else {
      fresh.push(model);
    }
  }
  return [...fresh, ...deprioritized];
}
var ModelTimeoutMemory = class {
  timedOutAt = /* @__PURE__ */ new Map();
  timedOutOnLargeImageAt = /* @__PURE__ */ new Map();
  record(model, nowMs = Date.now(), imageWasLarge = false) {
    this.timedOutAt.set(model, nowMs);
    if (imageWasLarge) {
      this.timedOutOnLargeImageAt.set(model, nowMs);
    }
  }
  orderCandidates(candidates, nowMs = Date.now(), imageIsLarge = false) {
    return deprioritizeRecentlyTimedOutModels(
      candidates,
      this.timedOutAt,
      nowMs,
      MODEL_TIMEOUT_DEPRIORITIZE_MS,
      this.timedOutOnLargeImageAt,
      imageIsLarge
    );
  }
};
var RequestTimeBudget = class {
  constructor(totalMs, nowFn = Date.now) {
    this.totalMs = totalMs;
    this.nowFn = nowFn;
    this.startedAtMs = nowFn();
  }
  startedAtMs;
  elapsedMs() {
    return this.nowFn() - this.startedAtMs;
  }
  remainingMs() {
    return Math.max(0, this.totalMs - this.elapsedMs());
  }
  isExhausted() {
    return this.remainingMs() < GEMINI_MIN_PER_CALL_TIMEOUT_MS;
  }
  /** Milliseconds for the next AbortSignal.timeout, or null if the budget is too low. */
  perCallTimeoutMs(capMs = GEMINI_REQUEST_TIMEOUT_MS) {
    const remaining = this.remainingMs();
    if (remaining < GEMINI_MIN_PER_CALL_TIMEOUT_MS) return null;
    return Math.min(capMs, remaining);
  }
};
function shouldRetrySameModelAfterError(error, httpRetriesUsed, maxHttpRetries = GEMINI_HTTP_RETRIES_PER_MODEL) {
  if (error.kind === "timeout") return false;
  if (error.kind === "http" && error.retryable) {
    return httpRetriesUsed < maxHttpRetries - 1;
  }
  return false;
}
function orderModelsForAttempt(primaryFromEnv, fallbacksFromEnv, timeoutMemory, nowMs = Date.now(), imageIsLarge = false) {
  const base = buildGeminiModelCandidates(primaryFromEnv, fallbacksFromEnv);
  return timeoutMemory.orderCandidates(base, nowMs, imageIsLarge);
}
function perCallGeminiTimeoutMs() {
  return parseGeminiRequestTimeoutMs(Deno.env.get("GEMINI_REQUEST_TIMEOUT_MS") ?? void 0);
}
function stableSortByName(items, identityKey) {
  return [...items].sort((a, b) => identityKey(a.name).localeCompare(identityKey(b.name)));
}
function pickBetterPantryName(a, b) {
  const lenA = a.trim().length;
  const lenB = b.trim().length;
  if (lenA !== lenB) return lenA > lenB ? a : b;
  return a.localeCompare(b) <= 0 ? a : b;
}
function mergePantryRowPair(existing, incoming) {
  const sameUnit = existing.unit.toLowerCase() === incoming.unit.toLowerCase();
  const quantity = sameUnit ? Math.max(existing.quantity, incoming.quantity) : Math.max(existing.quantity, incoming.quantity);
  return {
    ...existing,
    name: pickBetterPantryName(existing.name, incoming.name),
    quantity,
    unit: existing.unit || incoming.unit,
    confidence: Math.max(existing.confidence, incoming.confidence)
  };
}
function dedupePantryRows(items, identity) {
  const sorted = stableSortByName(items, identity.identityKey);
  const merged = [];
  for (const row of sorted) {
    const key = identity.identityKey(row.name);
    let matchIndex = -1;
    for (let i = 0; i < merged.length; i += 1) {
      const other = merged[i];
      const otherKey = identity.identityKey(other.name);
      if (key === otherKey || identity.rowsMatch(row.name, other.name)) {
        matchIndex = i;
        break;
      }
    }
    if (matchIndex >= 0) {
      merged[matchIndex] = mergePantryRowPair(merged[matchIndex], row);
    } else {
      merged.push(row);
    }
  }
  return stableSortByName(merged, identity.identityKey);
}
function mergePantryPasses(passA, passB, identity) {
  return dedupePantryRows([...passA, ...passB], identity);
}
function shouldRunPantryVerifySecondPass(_budgetExhausted) {
  return false;
}
var EDGE_PANTRY_MERGE_IDENTITY = {
  identityKey: normalizeNameKey,
  rowsMatch: () => false
};
var GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
var GEMINI_RETRY_BACKOFF_MS = 450;
var GEMINI_RETRYABLE_HTTP_STATUSES = /* @__PURE__ */ new Set([429, 500, 503]);
var geminiModelTimeoutMemory = new ModelTimeoutMemory();
var PANTRY_VISION_CACHE_VERSION = "v6";
var PANTRY_MAX_ITEMS = 120;
var GEMINI_DETERMINISTIC_SEED = 42;
var GEMINI_MAX_OUTPUT_TOKENS = 16384;
var GEMINI_MAX_OUTPUT_TOKENS_RETRY = 24576;
var SCAN_RESULT_CACHE_TTL_MS = 30 * 60 * 1e3;
var SCAN_RESULT_CACHE_MAX = 200;
var scanResultCache = /* @__PURE__ */ new Map();
function isModelNotFoundOrRetired(status, detail) {
  if (status !== 404) return false;
  const lower = detail.toLowerCase();
  return lower.includes("not found") || lower.includes("not_found") || lower.includes("retired") || lower.includes("no longer") || lower.includes("does not exist");
}
function isRetryableGeminiHttpFailure(status, detail) {
  return GEMINI_RETRYABLE_HTTP_STATUSES.has(status) || isModelNotFoundOrRetired(status, detail);
}
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
var MAX_IMAGE_BYTES = 4 * 1024 * 1024;
var ALLOWED_MIME = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/webp"]);
var PANTRY_CATEGORIES = [
  "spices",
  "meats",
  "produce",
  "dairy",
  "dry_goods",
  "cookware",
  "frozen",
  "condiments"
];
var PANTRY_STORAGE = ["pantry", "fridge", "spice_rack"];
var PRICE_TAG_JSON_SCHEMA = {
  type: "object",
  properties: {
    itemName: { type: "string" },
    price: { type: "number" },
    sizeUnit: { type: "string" },
    saleValidUntil: { type: ["string", "null"] }
  },
  required: ["itemName", "price"]
};
var RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string" },
          category: { type: "string", enum: [...PANTRY_CATEGORIES] },
          storage: { type: "string", enum: [...PANTRY_STORAGE] },
          confidence: { type: "number" }
        },
        required: ["name", "quantity", "unit", "category", "storage", "confidence"]
      }
    }
  },
  required: ["items"]
};
var userHits = /* @__PURE__ */ new Map();
var USER_WINDOW_MS = 6e4;
var USER_MAX_PER_WINDOW = 12;
async function userHasPlusPhotoScanAccess(userId) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("pantry-vision: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for plan check");
    return false;
  }
  const url = `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=plan,role`;
  let response;
  try {
    response = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`
      }
    });
  } catch (error) {
    console.warn("pantry-vision: plan lookup network error", error);
    return false;
  }
  if (!response.ok) {
    console.warn(`pantry-vision: plan lookup http ${response.status}`);
    return false;
  }
  try {
    const rows = await response.json();
    const row = rows[0];
    if (!row) return false;
    if (row.role === "admin") return true;
    return row.plan === "paid";
  } catch (error) {
    console.warn("pantry-vision: plan lookup parse error", error);
    return false;
  }
}
function checkUserRateLimit(userId) {
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
function userIdFromJwt(req) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload.sub === "string" && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}
function estimateBase64Bytes(base64) {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor(base64.length * 3 / 4) - padding;
}
function normalizeMime(value) {
  const mime = (value ?? "image/jpeg").toLowerCase().split(";")[0].trim();
  return mime === "image/jpg" ? "image/jpeg" : mime;
}
function parseScanLocationHint(raw) {
  if (typeof raw !== "string") return "pantry";
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (trimmed === "spice_rack" || trimmed === "spice-rack" || trimmed === "spicerack") return "spice_rack";
  if (PANTRY_STORAGE.includes(trimmed)) {
    return trimmed;
  }
  return "pantry";
}
async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function readImageFromRequest(req) {
  const contentType = req.headers.get("Content-Type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return jsonResponse({ error: 'Missing image file field "image"', code: "BAD_REQUEST" }, 400);
    }
    const mimeType2 = normalizeMime(file.type);
    if (!ALLOWED_MIME.has(mimeType2)) {
      return jsonResponse({ error: "Unsupported image type. Use JPEG, PNG, or WebP.", code: "BAD_REQUEST" }, 400);
    }
    const buffer = new Uint8Array(await file.arrayBuffer());
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return jsonResponse({ error: "Image too large. Resize on the client and try again.", code: "PAYLOAD_TOO_LARGE" }, 413);
    }
    const locationField = form.get("location");
    const scanLocation2 = parseScanLocationHint(
      typeof locationField === "string" ? locationField : void 0
    );
    const actionField = form.get("action");
    const action2 = actionField === "price-tag" ? "price-tag" : "pantry";
    const hashField = form.get("imageHash");
    const imageHash2 = typeof hashField === "string" ? hashField.trim() : void 0;
    return { bytes: buffer, mimeType: mimeType2, scanLocation: scanLocation2, action: action2, imageHash: imageHash2 };
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body", code: "BAD_REQUEST" }, 400);
  }
  const scanLocation = parseScanLocationHint(body.location);
  const action = body.action === "price-tag" ? "price-tag" : "pantry";
  const imageHash = typeof body.imageHash === "string" ? body.imageHash.trim() : void 0;
  const raw = body.imageBase64?.trim() ?? "";
  if (!raw) {
    return jsonResponse({ error: "imageBase64 is required", code: "BAD_REQUEST" }, 400);
  }
  const mimeType = normalizeMime(body.mimeType);
  if (!ALLOWED_MIME.has(mimeType)) {
    return jsonResponse({ error: "Unsupported mimeType", code: "BAD_REQUEST" }, 400);
  }
  const base64 = raw.includes(",") ? raw.split(",").pop() ?? "" : raw;
  if (estimateBase64Bytes(base64) > MAX_IMAGE_BYTES) {
    return jsonResponse({ error: "Image too large. Resize on the client and try again.", code: "PAYLOAD_TOO_LARGE" }, 413);
  }
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { bytes, mimeType, scanLocation, action, imageHash };
  } catch {
    return jsonResponse({ error: "Invalid base64 image data", code: "BAD_REQUEST" }, 400);
  }
}
function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 32768;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
function normalizeNameKey(name) {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function formatGenericIngredientName(raw) {
  return normalizeNameKey(raw);
}
function stableSortItems(items) {
  return [...items].sort((a, b) => normalizeNameKey(a.name).localeCompare(normalizeNameKey(b.name)));
}
function sanitizeItems(raw) {
  if (!raw || typeof raw !== "object") return [];
  const items = raw.items;
  if (!Array.isArray(items)) return [];
  const out = [];
  for (const entry of items) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name) continue;
    const quantity = Number(row.quantity);
    const unit = typeof row.unit === "string" ? row.unit.trim() || "each" : "each";
    const categoryRaw = typeof row.category === "string" ? row.category : "dry_goods";
    const category = PANTRY_CATEGORIES.includes(categoryRaw) ? categoryRaw : "dry_goods";
    const confidence = Number(row.confidence);
    const storageRaw = typeof row.storage === "string" ? row.storage.trim().toLowerCase() : "pantry";
    const storage = PANTRY_STORAGE.includes(storageRaw) ? storageRaw : "pantry";
    out.push({
      name: formatGenericIngredientName(name).slice(0, 120),
      quantity: Number.isFinite(quantity) && quantity > 0 ? Math.min(quantity, 9999) : 1,
      unit: unit.slice(0, 32),
      category,
      storage,
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5
    });
  }
  return stableSortItems(out).slice(0, PANTRY_MAX_ITEMS);
}
function dedupeItems(items) {
  return dedupePantryRows(items, EDGE_PANTRY_MERGE_IDENTITY);
}
function mergeItemPasses(passA, passB) {
  return mergePantryPasses(passA, passB, EDGE_PANTRY_MERGE_IDENTITY);
}
function getCachedScan(cacheKey) {
  const entry = scanResultCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.at > SCAN_RESULT_CACHE_TTL_MS) {
    scanResultCache.delete(cacheKey);
    return null;
  }
  return { items: entry.items, model: entry.model };
}
function setCachedScan(cacheKey, items, model) {
  if (scanResultCache.size >= SCAN_RESULT_CACHE_MAX) {
    const oldest = [...scanResultCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) scanResultCache.delete(oldest[0]);
  }
  scanResultCache.set(cacheKey, { at: Date.now(), items, model });
}
function scanLocationPromptHint(scanLocation) {
  switch (scanLocation) {
    case "fridge":
      return "The user is scanning their refrigerator. Expect chilled items: dairy, eggs, fresh meat and fish, produce, opened condiments, and leftovers. Still assign correct storage if something shelf-stable appears.";
    case "spice_rack":
      return "The user is scanning their spice rack. Expect dried spices, dried herbs, and seasonings. Still assign correct storage if a non-spice item appears.";
    default:
      return "The user is scanning pantry shelves. Expect dry goods, canned goods, snacks, cereal, baking supplies, shelf-stable sauces, bread, and similar room-temperature items. Still assign correct storage for perishables if visible.";
  }
}
function priceTagPrompt() {
  return 'You read grocery store shelf tags and price labels from a photo. Extract the product name, the shelf price in US dollars (number only, no $), the package size or unit (e.g. "16 oz", "1 gal", "each"), and an optional sale end date in YYYY-MM-DD if a sale or "valid through" date is visible. If no sale date is shown, set saleValidUntil to null. Do not invent prices that are not visible. Return JSON only.';
}
function sanitizePriceTag(raw) {
  if (!raw || typeof raw !== "object") return null;
  const row = raw;
  const itemName = typeof row.itemName === "string" ? row.itemName.trim() : "";
  const price = Number(row.price);
  if (!itemName || !Number.isFinite(price) || price < 0) return null;
  const sizeUnit = typeof row.sizeUnit === "string" && row.sizeUnit.trim() ? row.sizeUnit.trim().slice(0, 48) : void 0;
  let saleValidUntil = void 0;
  if (row.saleValidUntil === null) saleValidUntil = null;
  else if (typeof row.saleValidUntil === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.saleValidUntil.trim())) {
    saleValidUntil = row.saleValidUntil.trim();
  }
  return {
    itemName: itemName.slice(0, 120),
    price: Math.round(price * 100) / 100,
    sizeUnit,
    saleValidUntil
  };
}
function geminiEnumeratePrompt(scanLocation) {
  return "You inventory edible kitchen products from a photo for a home recipe app. Do NOT summarize or skip items.\n" + scanLocationPromptHint(scanLocation) + '\nRules:\n- Read the FRONT product label only. Ignore ingredient lists, nutrition panels, and side/back text.\n- Skip non-food (pet food, cleaning supplies, napkins, appliances, empty jars, bags, tools).\n- Do not guess: omit anything you cannot read clearly from the front label. Do NOT list products that are not visible.\n- Do NOT use barcodes. Never put store or product brand names in name (no Kraft, WinCo, Goldfish, etc.).\n- name: generic recipe ingredient only, lowercase, singular when natural (egg, cheddar cheese, milk). Be specific when it matters: honey peanut butter not almond butter; pancake syrup not maple syrup; powdered drink mix not juice brand; bread not bread mix; cheddar cheese crackers not just crackers.\n- Check lower shelves, back rows, and partially hidden items behind front-facing packages.\n- Scan shelf by shelf top-to-bottom; on each shelf go left-to-right.\n- One JSON object per distinct product. If three identical cans are visible, quantity 3 and unit "can".\n- quantity is optional rough count when visible; default 1. Use realistic units (oz, lb, each, bottle, jar, can). Set confidence 0-1.\nExamples: {"name":"black olives","quantity":1,"unit":"can","category":"dry_goods","storage":"pantry","confidence":0.9}\n{"name":"cheddar cheese","quantity":1,"unit":"block","category":"dairy","storage":"fridge","confidence":0.88}\n{"name":"eggs","quantity":12,"unit":"each","category":"dairy","storage":"fridge","confidence":0.9}\n{"name":"milk","quantity":1,"unit":"gallon","category":"dairy","storage":"fridge","confidence":0.87}\nReturn JSON only matching the schema.';
}
function geminiVerifyPrompt(scanLocation, passOneNames) {
  const list = passOneNames.slice(0, 80).map((n) => `- ${n}`).join("\n");
  return "You verify a pantry inventory from the same photo.\n" + scanLocationPromptHint(scanLocation) + "\nFirst pass already found:\n" + list + '\nLook at the image again. Return ONLY additional visible food products missing from that list.\nSame rules as before: name what the product actually is, generic recipe names (brands in brand field), check lower shelves and back rows, front label only, no non-food, no guesses, omit items not visible.\nIf nothing new is visible, return {"items":[]}.\nDo NOT repeat first-pass items. Do NOT re-list the full inventory. JSON only.';
}
function parseGeminiErrorDetail(status, text) {
  let detail = text.slice(0, 320);
  try {
    const errJson = JSON.parse(text);
    detail = errJson.error?.message ?? detail;
  } catch {
  }
  return { detail, retryable: isRetryableGeminiHttpFailure(status, detail) };
}
async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
async function callGeminiOnce(apiKey, model, mimeType, imageBase64, vision, budget) {
  const timeoutMs = budget.perCallTimeoutMs(perCallGeminiTimeoutMs());
  if (timeoutMs == null) {
    return { error: { kind: "timeout", retryable: false } };
  }
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
          { text: vision.prompt }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: vision.schema,
      temperature: 0,
      topP: 0.1,
      seed: GEMINI_DETERMINISTIC_SEED,
      maxOutputTokens: vision.maxOutputTokens
    }
  };
  let upstream;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    const isTimeout = error instanceof DOMException ? error.name === "TimeoutError" : error instanceof Error && error.name === "TimeoutError";
    if (isTimeout) {
      return { error: { kind: "timeout", retryable: false } };
    }
    const message = error instanceof Error ? error.message : "Network error calling Gemini";
    return {
      error: {
        kind: "http",
        status: 0,
        detail: message,
        retryable: false
      }
    };
  }
  const text = await upstream.text();
  if (!upstream.ok) {
    const parsed = parseGeminiErrorDetail(upstream.status, text);
    return {
      error: {
        kind: "http",
        status: upstream.status,
        detail: parsed.detail,
        retryable: parsed.retryable
      }
    };
  }
  try {
    const envelope = JSON.parse(text);
    const candidate = envelope.candidates?.[0];
    const partText = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const finishReason = candidate?.finishReason;
    if (!partText) {
      return {
        error: {
          kind: "http",
          status: 502,
          detail: "Empty model response",
          retryable: true
        }
      };
    }
    return { text: partText, finishReason };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse Gemini response";
    return {
      error: {
        kind: "http",
        status: 502,
        detail: message,
        retryable: false
      }
    };
  }
}
async function callPantryGeminiPass(apiKey, model, mimeType, imageBase64, prompt, maxOutputTokens, budget) {
  const result = await callGeminiOnce(apiKey, model, mimeType, imageBase64, {
    prompt,
    schema: RESPONSE_JSON_SCHEMA,
    maxOutputTokens
  }, budget);
  if ("error" in result) {
    if (result.error.detail === "Empty model response") {
      return { items: [] };
    }
    return result;
  }
  if (result.finishReason === "MAX_TOKENS") {
    const retry = await callGeminiOnce(apiKey, model, mimeType, imageBase64, {
      prompt,
      schema: RESPONSE_JSON_SCHEMA,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS_RETRY
    }, budget);
    if ("error" in retry) {
      if (retry.error.detail === "Empty model response") {
        return { items: [] };
      }
      return retry;
    }
    try {
      const parsed = JSON.parse(retry.text);
      return { items: sanitizeItems(parsed) };
    } catch {
      return {
        error: {
          kind: "http",
          status: 502,
          detail: "Truncated JSON after MAX_TOKENS retry",
          retryable: true
        }
      };
    }
  }
  try {
    const parsed = JSON.parse(result.text);
    return { items: sanitizeItems(parsed) };
  } catch {
    return {
      error: {
        kind: "http",
        status: 502,
        detail: "Failed to parse pantry JSON",
        retryable: true
      }
    };
  }
}
async function callPantryGeminiTwoPass(apiKey, model, mimeType, imageBase64, scanLocation, budget) {
  const passOne = await callPantryGeminiPass(
    apiKey,
    model,
    mimeType,
    imageBase64,
    geminiEnumeratePrompt(scanLocation),
    GEMINI_MAX_OUTPUT_TOKENS,
    budget
  );
  if ("error" in passOne) return passOne;
  const passOneDeduped = dedupeItems(passOne.items);
  if (!shouldRunPantryVerifySecondPass(budget.isExhausted())) {
    return { items: passOneDeduped, passes: 1 };
  }
  const passTwo = await callPantryGeminiPass(
    apiKey,
    model,
    mimeType,
    imageBase64,
    geminiVerifyPrompt(scanLocation, passOneDeduped.map((i) => i.name)),
    GEMINI_MAX_OUTPUT_TOKENS,
    budget
  );
  if ("error" in passTwo) {
    return { items: passOneDeduped, passes: 1 };
  }
  if (passTwo.items.length === 0) {
    return { items: passOneDeduped, passes: 1 };
  }
  return { items: mergeItemPasses(passOneDeduped, passTwo.items), passes: 2 };
}
async function callPriceTagGeminiOnce(apiKey, model, mimeType, imageBase64, budget) {
  const result = await callGeminiOnce(apiKey, model, mimeType, imageBase64, {
    prompt: priceTagPrompt(),
    schema: PRICE_TAG_JSON_SCHEMA,
    maxOutputTokens: 1024
  }, budget);
  if ("error" in result) return result;
  try {
    const parsed = JSON.parse(result.text);
    const tag = sanitizePriceTag(parsed);
    if (!tag) {
      return {
        error: {
          kind: "http",
          status: 502,
          detail: "Could not read a price from the tag",
          retryable: true
        }
      };
    }
    return { tag };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse price tag response";
    return {
      error: {
        kind: "http",
        status: 502,
        detail: message,
        retryable: false
      }
    };
  }
}
function formatAttemptError(model, error, timeoutMs) {
  if (error.kind === "timeout") {
    return `${model}: timed out (budget or ${timeoutMs}ms per call)`;
  }
  const statusLabel = error.status > 0 ? String(error.status) : "network";
  return `${model} (${statusLabel}): ${error.detail}`;
}
async function callPantryGeminiOnModel(apiKey, model, mimeType, imageBase64, scanLocation, budget) {
  let httpRetries = 0;
  while (true) {
    if (budget.isExhausted()) {
      return { error: { kind: "timeout", retryable: false } };
    }
    const result = await callPantryGeminiTwoPass(
      apiKey,
      model,
      mimeType,
      imageBase64,
      scanLocation,
      budget
    );
    if ("items" in result) return result;
    if (result.error.kind === "timeout") {
      geminiModelTimeoutMemory.record(model, Date.now(), isLargePantryImageBase64(imageBase64));
      return result;
    }
    if (!shouldRetrySameModelAfterError(result.error, httpRetries)) {
      return result;
    }
    httpRetries += 1;
    await sleep(GEMINI_RETRY_BACKOFF_MS * httpRetries);
  }
}
async function callPriceTagGeminiOnModel(apiKey, model, mimeType, imageBase64, budget) {
  let httpRetries = 0;
  while (true) {
    if (budget.isExhausted()) {
      return { error: { kind: "timeout", retryable: false } };
    }
    const result = await callPriceTagGeminiOnce(apiKey, model, mimeType, imageBase64, budget);
    if ("tag" in result) return result;
    if (result.error.kind === "timeout") {
      geminiModelTimeoutMemory.record(model);
      return result;
    }
    if (!shouldRetrySameModelAfterError(result.error, httpRetries)) {
      return result;
    }
    httpRetries += 1;
    await sleep(GEMINI_RETRY_BACKOFF_MS * httpRetries);
  }
}
var UPSTREAM_BUSY_MESSAGE = "Vision scan is busy right now. Try again in a moment.";
async function callPantryGeminiWithFallbacks(apiKey, mimeType, imageBase64, scanLocation) {
  const budget = new RequestTimeBudget(GEMINI_REQUEST_TOTAL_BUDGET_MS);
  const imageIsLarge = isLargePantryImageBase64(imageBase64);
  const candidates = orderModelsForAttempt(
    Deno.env.get("GEMINI_MODEL") ?? void 0,
    Deno.env.get("GEMINI_FALLBACK_MODELS") ?? void 0,
    geminiModelTimeoutMemory,
    Date.now(),
    imageIsLarge
  );
  const failures = [];
  const modelAttempts = [];
  for (const model of candidates) {
    if (budget.isExhausted()) {
      failures.push("request time budget exhausted before next model");
      modelAttempts.push({
        model,
        ok: false,
        message: "request time budget exhausted before next model"
      });
      break;
    }
    const result = await callPantryGeminiOnModel(
      apiKey,
      model,
      mimeType,
      imageBase64,
      scanLocation,
      budget
    );
    if ("items" in result) {
      modelAttempts.push({ model, ok: true });
      console.log(
        `pantry-vision: gemini ok model=${model} items=${result.items.length} passes=${result.passes}`
      );
      return {
        items: result.items,
        model,
        debug: { modelAttempts, geminiPasses: result.passes }
      };
    }
    const failureMessage = formatAttemptError(model, result.error, perCallGeminiTimeoutMs());
    failures.push(failureMessage);
    modelAttempts.push({
      model,
      ok: false,
      status: result.error.kind === "http" ? result.error.status : void 0,
      message: failureMessage
    });
    console.warn(`pantry-vision: gemini failed ${failures[failures.length - 1]}`);
  }
  const summary = failures.slice(-4).join(" | ");
  throw new Error(
    failures.some((f) => f.includes("budget")) ? `${UPSTREAM_BUSY_MESSAGE} (${summary})` : `Pantry scan could not reach Gemini after trying ${candidates.length} model(s). ${summary}`
  );
}
async function callPriceTagGeminiWithFallbacks(apiKey, mimeType, imageBase64) {
  const budget = new RequestTimeBudget(GEMINI_REQUEST_TOTAL_BUDGET_MS);
  const candidates = orderModelsForAttempt(
    Deno.env.get("GEMINI_MODEL") ?? void 0,
    Deno.env.get("GEMINI_FALLBACK_MODELS") ?? void 0,
    geminiModelTimeoutMemory
  );
  const failures = [];
  for (const model of candidates) {
    if (budget.isExhausted()) {
      failures.push("request time budget exhausted before next model");
      break;
    }
    const result = await callPriceTagGeminiOnModel(apiKey, model, mimeType, imageBase64, budget);
    if ("tag" in result) {
      console.log(`pantry-vision: price-tag ok model=${model} item=${result.tag.itemName}`);
      return { tag: result.tag, model };
    }
    failures.push(formatAttemptError(model, result.error, perCallGeminiTimeoutMs()));
    console.warn(`pantry-vision: price-tag failed ${failures[failures.length - 1]}`);
  }
  const summary = failures.slice(-4).join(" | ");
  throw new Error(
    failures.some((f) => f.includes("budget")) ? `${UPSTREAM_BUSY_MESSAGE} (${summary})` : `Could not read the shelf tag after trying ${candidates.length} model(s). ${summary}`
  );
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  const userId = userIdFromJwt(req);
  if (!userId) {
    return jsonResponse({ error: "Sign in required", code: "UNAUTHENTICATED" }, 401);
  }
  const planAllowed = await userHasPlusPhotoScanAccess(userId);
  if (!planAllowed) {
    return jsonResponse(
      {
        error: "Photo scanning requires MealPlanatic Plus.",
        code: "PLAN_REQUIRED"
      },
      403
    );
  }
  if (!checkUserRateLimit(userId)) {
    return jsonResponse(
      {
        error: "Too many pantry scans. Wait a minute and try again.",
        code: "RATE_LIMIT"
      },
      429
    );
  }
  const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!apiKey) {
    return jsonResponse(
      {
        error: "Pantry photo scan is not set up yet. Ask an admin to finish setup.",
        code: "NOT_CONFIGURED"
      },
      503
    );
  }
  try {
    const imageResult = await readImageFromRequest(req);
    if (imageResult instanceof Response) return imageResult;
    const imageBase64 = bytesToBase64(imageResult.bytes);
    const contentHash = imageResult.imageHash || await sha256Hex(imageResult.bytes);
    const cacheKey = `${PANTRY_VISION_CACHE_VERSION}|${imageResult.scanLocation}|${contentHash}`;
    if (imageResult.action === "price-tag") {
      const { tag, model: model2 } = await callPriceTagGeminiWithFallbacks(
        apiKey,
        imageResult.mimeType,
        imageBase64
      );
      return jsonResponse(
        {
          itemName: tag.itemName,
          price: tag.price,
          sizeUnit: tag.sizeUnit ?? null,
          saleValidUntil: tag.saleValidUntil ?? null,
          model: model2
        },
        200
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
          itemCount: cached.items.length
        },
        200
      );
    }
    const { items, model, debug } = await callPantryGeminiWithFallbacks(
      apiKey,
      imageResult.mimeType,
      imageBase64,
      imageResult.scanLocation
    );
    setCachedScan(cacheKey, items, model);
    return jsonResponse(
      {
        items,
        model,
        debug,
        scanLocation: imageResult.scanLocation,
        cached: false,
        itemCount: items.length
      },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong while analyzing your photo.";
    return jsonResponse({ error: message, code: "UPSTREAM_ERROR" }, 502);
  }
});
