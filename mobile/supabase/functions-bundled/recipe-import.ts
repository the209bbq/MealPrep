// AUTO-GENERATED single-file bundle for pasting into the Supabase dashboard. Source: supabase/functions/recipe-import/
// supabase/functions/recipe-import/ssrfGuard.ts
function parseIpv4(host) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const octets = m.slice(1, 5).map((part) => Number.parseInt(part, 10));
  if (octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) return null;
  return octets;
}
function ipv4ToUint32(octets) {
  return octets[0] * 16777216 + octets[1] * 65536 + octets[2] * 256 + octets[3] >>> 0;
}
function isBlockedIpv4Host(host) {
  const octets = parseIpv4(host);
  if (!octets) return false;
  const n = ipv4ToUint32(octets);
  const mask = (bits) => (n & bits) >>> 0;
  if (n >>> 24 === 0) return true;
  if (n >>> 24 === 127) return true;
  if (n >>> 24 === 10) return true;
  if (mask(4293918720) === 2886729728) return true;
  if (mask(4294901760) === 3232235520) return true;
  if (mask(4294901760) === 2851995648) return true;
  if (mask(4290772992) === 1681915904) return true;
  return false;
}
function expandIpv6Hextets(host) {
  let h = host.trim().toLowerCase();
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
  if (!h.includes(":")) return null;
  const parts = h.split("::");
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(":").filter(Boolean) : [];
  const tail = parts[1] ? parts[1].split(":").filter(Boolean) : [];
  const missing = 8 - head.length - tail.length;
  if (parts.length === 1 && head.length !== 8) return null;
  if (parts.length === 2 && missing < 1) return null;
  if (parts.length === 2 && head.length + tail.length >= 8) return null;
  const zeros = parts.length === 2 ? Array(missing).fill("0") : [];
  const full = [...head, ...zeros, ...tail];
  if (full.length !== 8) return null;
  if (full.some((piece) => !/^[0-9a-f]{1,4}$/i.test(piece))) return null;
  return full;
}
function isBlockedIpv6Host(host) {
  const lower = host.trim().toLowerCase();
  if (lower === "::1" || lower === "[::1]") return true;
  const hextets = expandIpv6Hextets(host);
  if (!hextets) return false;
  const first = Number.parseInt(hextets[0], 16);
  if ((first & 65024) === 64512) return true;
  if ((first & 65472) === 65152) return true;
  return false;
}
function isBlockedHostname(host) {
  const h = host.trim().toLowerCase().replace(/\.$/, "");
  if (!h) return true;
  if (h === "localhost") return true;
  if (h.endsWith(".localhost")) return true;
  if (h.endsWith(".local")) return true;
  if (h.endsWith(".internal")) return true;
  if (isBlockedIpv4Host(h)) return true;
  if (isBlockedIpv6Host(h)) return true;
  return false;
}
function isAllowedHttpPort(url) {
  if (!url.port) return true;
  if (url.protocol === "http:" && url.port === "80") return true;
  if (url.protocol === "https:" && url.port === "443") return true;
  return false;
}
function validatePublicHttpFetchUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "bad_protocol" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "credentials" };
  }
  if (!isAllowedHttpPort(url)) {
    return { ok: false, reason: "bad_port" };
  }
  if (isBlockedHostname(url.hostname)) {
    return { ok: false, reason: "blocked_host" };
  }
  return { ok: true, url };
}
var RECIPE_FETCH_MAX_REDIRECTS = 3;
function resolveRedirectLocation(current, locationHeader) {
  try {
    return new URL(locationHeader, current).toString();
  } catch {
    return null;
  }
}

// supabase/functions/recipe-import/urlClassification.ts
var YOUTUBE_HOSTS = /* @__PURE__ */ new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be"
]);
var TIKTOK_HOSTS = /* @__PURE__ */ new Set(["tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"]);
var INSTAGRAM_HOSTS = /* @__PURE__ */ new Set(["instagram.com", "www.instagram.com"]);
var FACEBOOK_HOSTS = /* @__PURE__ */ new Set([
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "fb.watch",
  "www.fb.watch"
]);
function normalizeImportUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const validated = validatePublicHttpFetchUrl(withProtocol);
    if (!validated.ok) return null;
    const url = validated.url;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
function classifyRecipeImportUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (YOUTUBE_HOSTS.has(host)) return "youtube";
  if (host.endsWith(".youtube.com")) return "youtube";
  if (url.pathname.includes("/shorts/")) return "youtube";
  if (TIKTOK_HOSTS.has(host) || host.endsWith(".tiktok.com")) return "tiktok";
  if (INSTAGRAM_HOSTS.has(host) || host.endsWith(".instagram.com")) return "instagram";
  if (FACEBOOK_HOSTS.has(host) || host.endsWith(".facebook.com") || host === "fb.watch") {
    return "facebook";
  }
  return "web";
}
function isManualCaptionSourceType(type) {
  return type === "instagram" || type === "facebook";
}
function canonicalYouTubeWatchUrl(urlString) {
  try {
    const url = new URL(urlString);
    const host = url.hostname.toLowerCase();
    if (host === "youtu.be") {
      const id = url.pathname.replace(/^\//, "").split("/")[0];
      if (id) return `https://www.youtube.com/watch?v=${id}`;
    }
    if (url.pathname.startsWith("/shorts/")) {
      const id = url.pathname.split("/")[2];
      if (id) return `https://www.youtube.com/watch?v=${id}`;
    }
    const v = url.searchParams.get("v");
    if (v) return `https://www.youtube.com/watch?v=${v}`;
  } catch {
  }
  return urlString;
}
function urlHashKey(urlString) {
  return urlString.trim().toLowerCase();
}

// supabase/functions/recipe-import/fallbackChain.ts
function orderImportFallbackSteps(context) {
  const steps = [];
  if (context.youtubeSuggestionAvailable) {
    steps.push("youtube_confirm");
  }
  steps.push("video_upload", "screenshot");
  if ((context.sourceType === "instagram" || context.sourceType === "facebook") && !context.hasCaption) {
    steps.push("paste_caption");
  }
  return steps;
}

// supabase/functions/recipe-import/tiktokOembed.ts
function parseTikTokOembedPayload(raw) {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw;
  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  if (!title) return null;
  const authorName = typeof obj.author_name === "string" && obj.author_name.trim() ? obj.author_name.trim() : "creator";
  const authorUrl = typeof obj.author_url === "string" && obj.author_url.trim() ? obj.author_url.trim() : null;
  const thumbnailUrl = typeof obj.thumbnail_url === "string" && obj.thumbnail_url.trim() ? obj.thumbnail_url.trim() : null;
  return { caption: title, authorName, authorUrl, thumbnailUrl };
}
async function fetchTikTokOembed(postUrl) {
  const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(postUrl)}`;
  let response;
  try {
    response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(1e4)
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  try {
    const json = await response.json();
    return parseTikTokOembedPayload(json);
  } catch {
    return null;
  }
}

// supabase/functions/recipe-import/dishGuess.ts
function normalizeCreatorForSearch(name) {
  return name.replace(/^@+/, "").replace(/\s+/g, " ").trim();
}
function guessDishQueryFromCaption(caption) {
  const lines = caption.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const first = lines[0] ?? caption.trim();
  const withoutTags = first.replace(/#\w+/g, "").replace(/\s+/g, " ").trim();
  const withoutEmoji = withoutTags.replace(
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,
    ""
  );
  const cleaned = withoutEmoji.replace(/[^\w\s'-]/g, " ").replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length <= 8) return cleaned.slice(0, 80);
  return words.slice(0, 8).join(" ");
}
function buildYoutubeSearchQuery(creator, dishGuess) {
  const parts = [];
  const creatorNorm = creator ? normalizeCreatorForSearch(creator) : "";
  if (creatorNorm) parts.push(creatorNorm);
  if (dishGuess) parts.push(dishGuess);
  parts.push("recipe");
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 120);
}

// supabase/functions/recipe-import/youtubeSearch.ts
function fuzzyChannelMatch(creatorHint, channelTitle) {
  const a = normalizeCreatorForSearch(creatorHint).toLowerCase();
  const b = channelTitle.toLowerCase().replace(/\s+/g, " ");
  if (!a || !b) return false;
  if (b.includes(a) || a.includes(b)) return true;
  const aTokens = a.split(/\s+/).filter((t) => t.length > 2);
  if (aTokens.length === 0) return false;
  const matched = aTokens.filter((t) => b.includes(t)).length;
  return matched >= Math.min(2, aTokens.length);
}
async function searchYoutubeRecipeVideo(apiKey, creatorHint, captionOrTitle) {
  if (!apiKey.trim()) return null;
  const dish = guessDishQueryFromCaption(captionOrTitle);
  const q = buildYoutubeSearchQuery(creatorHint, dish);
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "5");
  url.searchParams.set("q", q);
  url.searchParams.set("key", apiKey);
  let response;
  try {
    response = await fetch(url.toString(), { signal: AbortSignal.timeout(12e3) });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const body = await response.json();
  const items = body.items ?? [];
  const creator = creatorHint ? normalizeCreatorForSearch(creatorHint) : null;
  let best = null;
  for (const item of items) {
    const videoId = item.id?.videoId;
    const channelTitle = item.snippet?.channelTitle?.trim() ?? "";
    const title = item.snippet?.title?.trim() ?? "";
    if (!videoId || !title) continue;
    const candidate = {
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
      videoId,
      channelTitle,
      title
    };
    if (creator && fuzzyChannelMatch(creator, channelTitle)) {
      return candidate;
    }
    if (!best) best = candidate;
  }
  return best;
}

// supabase/functions/pantry-vision/geminiOrchestration.ts
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

// supabase/functions/recipe-import/recipeImportSchema.ts
var GEMINI_RECIPE_IMPORT_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    servings: { type: "integer" },
    prep_minutes: { type: ["integer", "null"] },
    cook_minutes: { type: ["integer", "null"] },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string" },
          note: { type: ["string", "null"] }
        },
        required: ["name", "quantity", "unit"]
      }
    },
    steps: { type: "array", items: { type: "string" } },
    is_recipe: { type: "boolean" },
    confidence: { type: "number" },
    youtube_channel_name: { type: ["string", "null"] },
    cookbook_author_name: { type: ["string", "null"] },
    cookbook_title_guess: { type: ["string", "null"] }
  },
  required: ["title", "servings", "ingredients", "steps", "is_recipe", "confidence"]
};
function validateGeminiRecipeImportPayload(raw) {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw;
  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  if (!title) return null;
  const servings = typeof obj.servings === "number" && Number.isFinite(obj.servings) ? Math.max(1, Math.round(obj.servings)) : 4;
  const prep_minutes = typeof obj.prep_minutes === "number" && Number.isFinite(obj.prep_minutes) ? Math.max(0, Math.round(obj.prep_minutes)) : null;
  const cook_minutes = typeof obj.cook_minutes === "number" && Number.isFinite(obj.cook_minutes) ? Math.max(0, Math.round(obj.cook_minutes)) : null;
  const ingredients = [];
  if (Array.isArray(obj.ingredients)) {
    for (const entry of obj.ingredients) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry;
      const name = typeof row.name === "string" ? row.name.trim() : "";
      if (!name) continue;
      const quantity = typeof row.quantity === "number" && Number.isFinite(row.quantity) ? row.quantity : 1;
      const unit = typeof row.unit === "string" && row.unit.trim() ? row.unit.trim() : "each";
      const note = typeof row.note === "string" && row.note.trim() ? row.note.trim() : void 0;
      ingredients.push({ name, quantity, unit, note });
    }
  }
  const steps = [];
  if (Array.isArray(obj.steps)) {
    for (const step of obj.steps) {
      if (typeof step === "string" && step.trim()) steps.push(step.trim());
    }
  }
  const is_recipe = obj.is_recipe === true;
  const confidence = typeof obj.confidence === "number" && Number.isFinite(obj.confidence) ? Math.min(1, Math.max(0, obj.confidence)) : 0.5;
  const youtube_channel_name = typeof obj.youtube_channel_name === "string" && obj.youtube_channel_name.trim() ? obj.youtube_channel_name.trim() : null;
  return {
    title,
    servings,
    prep_minutes,
    cook_minutes,
    ingredients,
    steps,
    is_recipe,
    confidence,
    source_url: "",
    source_type: "web",
    youtube_channel_name
  };
}
function attachImportMetadata(recipe, sourceUrl, sourceType, extras) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const base = {
    ...recipe,
    source_url: sourceUrl,
    source_type: sourceType,
    social_author_name: extras?.socialAuthorName ?? null,
    social_author_url: extras?.socialAuthorUrl ?? null,
    author_public_recipe_url: extras?.authorPublicRecipeUrl ?? null
  };
  if (sourceType === "youtube") {
    return {
      ...base,
      source_title: void 0,
      metadata_refreshed_at: now
    };
  }
  if (sourceType === "tiktok" || sourceType === "instagram" || sourceType === "facebook") {
    return {
      ...base,
      source_title: void 0,
      youtube_channel_name: null
    };
  }
  if (sourceType === "photo" || sourceType === "video") {
    return {
      ...base,
      source_title: void 0,
      youtube_channel_name: null,
      source_url: sourceUrl || "photo-scan"
    };
  }
  return base;
}

// supabase/functions/recipe-import/geminiRecipeExtract.ts
var GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
var GEMINI_DETERMINISTIC_SEED = 42;
var GEMINI_MAX_OUTPUT_TOKENS = 8192;
var geminiModelTimeoutMemory = new ModelTimeoutMemory();
var TEXT_EXTRACTION_PROMPT = "Extract a home-cooking recipe from the page text. Rewrite steps and ingredient lines in your own words (do not copy marketing or blog prose). Use generic ingredient names (no brands). Return clear step-by-step instructions as short strings. If this is not a recipe, set is_recipe false and confidence low.";
var YOUTUBE_EXTRACTION_PROMPT = "You are helping a meal-planning app. The video is referenced by URL only \u2014 do not download, store, or reproduce the video or audio. Watch the cooking video and extract a recipe with clear step-by-step INSTRUCTIONS and ingredients with quantities and units. Rewrite the dish title, ingredients, and steps in fresh wording (never copy the video title, description, or transcript verbatim). Set youtube_channel_name to the visible YouTube channel/creator name when you can see it, otherwise null. Use generic ingredient names (no brands). If this is not a recipe video, set is_recipe false with a low confidence score.";
var SOCIAL_CAPTION_PROMPT = "Extract a home-cooking recipe from this social post caption. Rewrite the title, ingredients, and steps in your own words (do not copy the caption verbatim). Use generic ingredient names (no brands). Return clear step-by-step instructions. If this is not a recipe, set is_recipe false and confidence low.";
var PHOTO_RECIPE_PROMPT = "Extract a home-cooking recipe from these photos (printed cookbook pages, recipe cards, or handwritten cards). Rewrite the title, ingredients, and steps in your own words \u2014 never copy publisher text verbatim. Use generic ingredient names. Return clear step-by-step instructions. If you can read an author or book name, set cookbook_author_name and cookbook_title_guess; otherwise null. If this is not a recipe, set is_recipe false and confidence low.";
var SCREENSHOT_RECIPE_PROMPT = "Extract a home-cooking recipe from these screenshots of a social post or web page. Rewrite in your own words. Use generic ingredient names and clear steps. If this is not a recipe, set is_recipe false and confidence low.";
var UPLOADED_VIDEO_PROMPT = "Extract a home-cooking recipe from this cooking video the user saved on their device. Focus on accurate step-by-step INSTRUCTIONS and ingredients with quantities. Rewrite in fresh wording. Use generic ingredient names. If this is not a recipe video, set is_recipe false with low confidence.";
async function callGeminiJson(apiKey, model, parts, budget) {
  const timeoutMs = budget.perCallTimeoutMs(GEMINI_REQUEST_TIMEOUT_MS);
  if (timeoutMs == null) {
    return { error: { kind: "timeout", detail: "budget exhausted", retryable: false } };
  }
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: GEMINI_RECIPE_IMPORT_JSON_SCHEMA,
      temperature: 0,
      topP: 0.1,
      seed: GEMINI_DETERMINISTIC_SEED,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS
    }
  };
  let upstream;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    const isTimeout = error instanceof DOMException ? error.name === "TimeoutError" : error instanceof Error && error.name === "TimeoutError";
    return {
      error: {
        kind: isTimeout ? "timeout" : "http",
        detail: error instanceof Error ? error.message : "network error",
        retryable: !isTimeout
      }
    };
  }
  const text = await upstream.text();
  if (!upstream.ok) {
    return {
      error: {
        kind: "http",
        status: upstream.status,
        detail: text.slice(0, 320),
        retryable: upstream.status === 429 || upstream.status >= 500
      }
    };
  }
  try {
    const envelope = JSON.parse(text);
    const partText = envelope.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!partText) {
      return { error: { kind: "http", status: 502, detail: "empty model response", retryable: true } };
    }
    return { payload: JSON.parse(partText) };
  } catch (error) {
    return {
      error: {
        kind: "http",
        status: 502,
        detail: error instanceof Error ? error.message : "parse error",
        retryable: false
      }
    };
  }
}
async function callGeminiWithFallback(apiKey, parts) {
  const budget = new RequestTimeBudget(GEMINI_REQUEST_TOTAL_BUDGET_MS);
  const candidates = orderModelsForAttempt(
    Deno.env.get("GEMINI_MODEL") ?? void 0,
    Deno.env.get("GEMINI_FALLBACK_MODELS") ?? void 0,
    geminiModelTimeoutMemory
  );
  for (const model of candidates) {
    if (budget.isExhausted()) break;
    let httpRetries = 0;
    for (; ; ) {
      const result = await callGeminiJson(apiKey, model, parts, budget);
      if ("payload" in result) {
        const validated = validateGeminiRecipeImportPayload(result.payload);
        if (validated) return validated;
        break;
      }
      if (result.error.kind === "timeout") {
        geminiModelTimeoutMemory.record(model);
        break;
      }
      if (shouldRetrySameModelAfterError(result.error, httpRetries, GEMINI_HTTP_RETRIES_PER_MODEL)) {
        httpRetries += 1;
        continue;
      }
      break;
    }
  }
  return null;
}
async function extractRecipeFromYouTubeVideo(apiKey, youtubeUrl, sourceType, sourceUrl) {
  const parts = [
    { file_data: { mime_type: "video/*", file_uri: youtubeUrl } },
    { text: YOUTUBE_EXTRACTION_PROMPT }
  ];
  const extracted = await callGeminiWithFallback(apiKey, parts);
  if (!extracted) return null;
  return attachImportMetadata(extracted, sourceUrl, sourceType);
}
async function extractRecipeFromPageText(apiKey, pageText, sourceUrl, sourceType = "web") {
  const prompt = sourceType === "tiktok" || sourceType === "instagram" || sourceType === "facebook" ? SOCIAL_CAPTION_PROMPT : TEXT_EXTRACTION_PROMPT;
  const parts = [
    {
      text: `${prompt}

Source URL: ${sourceUrl}

Text:
${pageText}`
    }
  ];
  const extracted = await callGeminiWithFallback(apiKey, parts);
  if (!extracted) return null;
  return attachImportMetadata(extracted, sourceUrl, sourceType);
}
async function extractRecipeFromGeminiParts(apiKey, parts, sourceUrl, sourceType, extras) {
  const extracted = await callGeminiWithFallback(apiKey, parts);
  if (!extracted) return null;
  return attachImportMetadata(extracted, sourceUrl, sourceType, extras);
}
async function extractRecipeFromPhotos(apiKey, parts, sourceUrl) {
  const withPrompt = [{ text: PHOTO_RECIPE_PROMPT }, ...parts];
  return extractRecipeFromGeminiParts(apiKey, withPrompt, sourceUrl, "photo");
}
async function extractRecipeFromScreenshots(apiKey, parts, sourceUrl, sourceType) {
  const withPrompt = [{ text: SCREENSHOT_RECIPE_PROMPT }, ...parts];
  return extractRecipeFromGeminiParts(apiKey, withPrompt, sourceUrl, sourceType);
}
async function extractRecipeFromUploadedVideo(apiKey, parts, sourceUrl) {
  const withPrompt = [{ text: UPLOADED_VIDEO_PROMPT }, ...parts];
  return extractRecipeFromGeminiParts(apiKey, withPrompt, sourceUrl, "video");
}

// supabase/functions/recipe-import/durationParse.ts
function parseIso8601DurationToMinutes(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  if (typeof value !== "string") return null;
  const raw = value.trim().toUpperCase();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Math.max(0, Number.parseInt(raw, 10));
  const match = raw.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i
  );
  if (!match) return null;
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  const total = days * 24 * 60 + hours * 60 + minutes + Math.round(seconds / 60);
  return total > 0 ? total : null;
}
function parseRecipeYieldToServings(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.round(value));
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const parsed = parseRecipeYieldToServings(entry);
      if (parsed != null) return parsed;
    }
    return null;
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  const range = text.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) {
    const low = Number.parseInt(range[1], 10);
    const high = Number.parseInt(range[2], 10);
    if (!Number.isNaN(low) && !Number.isNaN(high)) {
      return Math.max(1, Math.round((low + high) / 2));
    }
  }
  const firstNum = text.match(/(\d+)/);
  if (firstNum) return Math.max(1, Number.parseInt(firstNum[1], 10));
  return null;
}

// supabase/functions/recipe-import/jsonLdParser.ts
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asString(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}
function collectJsonLdNodes(doc) {
  const nodes = [];
  if (!isObject(doc)) return nodes;
  const graph = doc["@graph"];
  if (Array.isArray(graph)) {
    for (const entry of graph) {
      if (isObject(entry)) nodes.push(entry);
    }
  }
  nodes.push(doc);
  return nodes;
}
function recipeTypeMatches(typeField) {
  if (typeof typeField === "string") {
    return typeField.toLowerCase().includes("recipe");
  }
  if (Array.isArray(typeField)) {
    return typeField.some((t) => typeof t === "string" && t.toLowerCase().includes("recipe"));
  }
  return false;
}
function parseIngredientLine(text) {
  const trimmed = text.trim();
  const match = trimmed.match(
    /^([\d./\s]+)?\s*([a-zA-Z]+(?:\.[a-zA-Z]+)?)?\s+(.+)$/
  );
  if (!match) {
    return { name: trimmed, quantity: 1, unit: "each" };
  }
  const qtyRaw = (match[1] ?? "").trim();
  const unitRaw = (match[2] ?? "").trim();
  const name = (match[3] ?? trimmed).trim();
  let quantity = 1;
  if (qtyRaw) {
    if (qtyRaw.includes("/")) {
      const [a, b] = qtyRaw.split("/").map((p) => Number.parseFloat(p.trim()));
      if (a && b) quantity = a / b;
    } else {
      const n = Number.parseFloat(qtyRaw.replace(/\s+/g, ""));
      if (!Number.isNaN(n)) quantity = n;
    }
  }
  const unit = unitRaw || "each";
  return { name, quantity, unit };
}
function parseIngredientObject(ing) {
  const name = asString(ing.name) || asString(ing.item) || asString(ing.ingredient);
  const amount = ing.amount;
  if (isObject(amount)) {
    const qty = Number(amount.value ?? amount.amount ?? 1);
    const unit = asString(amount.unitText) || asString(amount.unit) || "each";
    return { name, quantity: Number.isFinite(qty) ? qty : 1, unit };
  }
  if (typeof amount === "string" && amount.trim()) {
    const parsed = parseIngredientLine(amount);
    return { ...parsed, name: name || parsed.name };
  }
  return parseIngredientLine(name);
}
function extractSteps(instructions) {
  if (!instructions) return [];
  if (typeof instructions === "string") {
    return instructions.split(/\n+/).map((line) => line.trim()).filter((line) => line.length > 0);
  }
  if (!Array.isArray(instructions)) {
    if (isObject(instructions)) {
      return extractSteps([instructions]);
    }
    return [];
  }
  const steps = [];
  for (const entry of instructions) {
    if (typeof entry === "string") {
      const t = entry.trim();
      if (t) steps.push(t);
      continue;
    }
    if (!isObject(entry)) continue;
    const type = asString(entry["@type"]).toLowerCase();
    if (type.includes("howtosection")) {
      steps.push(...extractSteps(entry.itemListElement ?? entry.hasPart));
      continue;
    }
    if (type.includes("howtostep") || entry.text) {
      const text = asString(entry.text) || asString(entry.name);
      if (text) steps.push(text);
      continue;
    }
    if (entry.itemListElement) {
      steps.push(...extractSteps(entry.itemListElement));
    }
  }
  return steps;
}
function findRecipeJsonLdInHtml(html) {
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const candidates = Array.isArray(parsed) ? parsed.flatMap((entry) => isObject(entry) ? collectJsonLdNodes(entry) : []) : isObject(parsed) ? collectJsonLdNodes(parsed) : [];
      for (const node of candidates) {
        if (recipeTypeMatches(node["@type"])) return node;
      }
    } catch {
    }
  }
  return null;
}
function recipeJsonLdToExtracted(node, sourceUrl) {
  const title = asString(node.name) || asString(node.headline);
  if (!title) return null;
  const ingredientsRaw = node.recipeIngredient ?? node.ingredients;
  const ingredients = [];
  if (Array.isArray(ingredientsRaw)) {
    for (const entry of ingredientsRaw) {
      if (typeof entry === "string") {
        const parsed = parseIngredientLine(entry);
        if (parsed.name) ingredients.push({ ...parsed, note: void 0 });
      } else if (isObject(entry)) {
        const parsed = parseIngredientObject(entry);
        if (parsed.name) ingredients.push(parsed);
      }
    }
  }
  const steps = extractSteps(node.recipeInstructions ?? node.step);
  const prep = parseIso8601DurationToMinutes(node.prepTime) ?? parseIso8601DurationToMinutes(node.preparationTime);
  const cook = parseIso8601DurationToMinutes(node.cookTime);
  const total = parseIso8601DurationToMinutes(node.totalTime);
  const resolvedPrep = prep ?? (total != null && cook != null ? Math.max(0, total - cook) : prep);
  const resolvedCook = cook ?? (total != null && prep != null ? Math.max(0, total - prep) : total);
  const servings = parseRecipeYieldToServings(node.recipeYield) ?? 4;
  const hasRecipeSignal = ingredients.length > 0 || steps.length > 0;
  return {
    title,
    servings,
    prep_minutes: resolvedPrep,
    cook_minutes: resolvedCook,
    ingredients,
    steps,
    is_recipe: hasRecipeSignal,
    confidence: hasRecipeSignal ? 0.92 : 0.4,
    source_url: sourceUrl,
    source_type: "web",
    source_title: title
  };
}
function stripHtmlToText(html, maxChars) {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const text = withoutScripts.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}
\u2026`;
}

// supabase/functions/recipe-import/storagePathValidation.ts
function validateUserImportStoragePath(userId, storagePath) {
  if (!userId.trim()) return false;
  const normalized = storagePath.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!normalized || normalized.includes("..")) return false;
  const segments = normalized.split("/").filter((segment) => segment.length > 0);
  if (segments.length < 2) return false;
  if (segments[0] !== userId) return false;
  return segments.every((segment) => segment !== "." && segment !== "..");
}

// supabase/functions/recipe-import/importMedia.ts
var GEMINI_API_BASE2 = "https://generativelanguage.googleapis.com/v1beta";
var IMPORT_UPLOAD_BUCKET = "recipe-import-uploads";
var INLINE_VIDEO_MAX_BYTES = 6 * 1024 * 1024;
var STALE_UPLOAD_MAX_AGE_MS = 60 * 60 * 1e3;
function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
function serviceStorageHeaders(serviceKey) {
  return { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
}
async function cleanupStaleUserImportUploads(userId, maxAgeMs = STALE_UPLOAD_MAX_AGE_MS) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return;
  const listUrl = `${supabaseUrl}/storage/v1/object/list/${IMPORT_UPLOAD_BUCKET}`;
  let response;
  try {
    response = await fetch(listUrl, {
      method: "POST",
      headers: {
        ...serviceStorageHeaders(serviceKey),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prefix: `${userId}/`,
        limit: 100,
        sortBy: { column: "created_at", order: "asc" }
      })
    });
  } catch {
    return;
  }
  if (!response.ok) return;
  const rows = await response.json();
  const cutoff = Date.now() - maxAgeMs;
  for (const row of rows) {
    const name = row.name?.trim();
    if (!name) continue;
    const createdAt = row.created_at ? Date.parse(row.created_at) : NaN;
    if (!Number.isFinite(createdAt) || createdAt >= cutoff) continue;
    const path = `${userId}/${name}`;
    if (!validateUserImportStoragePath(userId, path)) continue;
    await deleteUserImportObject(userId, path);
  }
}
async function downloadUserImportObject(userId, storagePath) {
  if (!validateUserImportStoragePath(userId, storagePath)) return null;
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return null;
  const normalized = storagePath.replace(/^\/+/, "");
  const objectUrl = `${supabaseUrl}/storage/v1/object/${IMPORT_UPLOAD_BUCKET}/${normalized}`;
  const response = await fetch(objectUrl, {
    headers: serviceStorageHeaders(serviceKey)
  });
  if (!response.ok) return null;
  const mimeType = (response.headers.get("content-type") ?? "application/octet-stream").split(";")[0].trim();
  const buffer = new Uint8Array(await response.arrayBuffer());
  if (buffer.length === 0 || buffer.length > 104857600) return null;
  return { bytes: buffer, mimeType };
}
async function deleteUserImportObject(userId, storagePath) {
  if (!validateUserImportStoragePath(userId, storagePath)) return;
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return;
  const normalized = storagePath.replace(/^\/+/, "");
  await fetch(`${supabaseUrl}/storage/v1/object/${IMPORT_UPLOAD_BUCKET}/${normalized}`, {
    method: "DELETE",
    headers: serviceStorageHeaders(serviceKey)
  });
}
async function downloadUserImportImages(userId, storagePaths) {
  const allowed = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/webp"]);
  const out = [];
  for (const path of storagePaths) {
    const downloaded = await downloadUserImportObject(userId, path);
    if (!downloaded) return null;
    const mime = downloaded.mimeType.toLowerCase();
    if (!allowed.has(mime)) return null;
    out.push({ mimeType: mime, base64: bytesToBase64(downloaded.bytes) });
  }
  return out.length > 0 ? out : null;
}
async function uploadVideoToGeminiFiles(apiKey, bytes, mimeType) {
  const start = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(bytes.length),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ file: { display_name: "recipe-import-video" } })
    }
  );
  if (!start.ok) return null;
  const uploadTarget = start.headers.get("X-Goog-Upload-URL");
  if (!uploadTarget) return null;
  const upload = await fetch(uploadTarget, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.length),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
      "Content-Type": mimeType
    },
    body: bytes
  });
  if (!upload.ok) return null;
  const body = await upload.json();
  const fileName = body.file?.name;
  const fileUri = body.file?.uri;
  if (!fileName || !fileUri) return null;
  return { fileUri, fileName };
}
async function deleteGeminiFile(apiKey, fileName) {
  await fetch(`${GEMINI_API_BASE2}/${fileName}?key=${encodeURIComponent(apiKey)}`, {
    method: "DELETE"
  });
}
function buildGeminiPartsForVideo(bytes, mimeType, prompt, fileUri) {
  if (fileUri) {
    return [{ file_data: { mime_type: mimeType, file_uri: fileUri } }, { text: prompt }];
  }
  return [
    { inline_data: { mime_type: mimeType, data: bytesToBase64(bytes) } },
    { text: prompt }
  ];
}
function shouldUseGeminiFileApi(byteLength) {
  return byteLength > INLINE_VIDEO_MAX_BYTES;
}
function validatePhotoStoragePaths(userId, paths) {
  if (paths.length === 0 || paths.length > 4) return false;
  return paths.every((path) => validateUserImportStoragePath(userId, path));
}

// supabase/functions/recipe-import/autoYoutubeFallback.ts
async function tryAutoImportFromYoutubeSearch(apiKey, importFromUrl2, captionForSearch, creatorHint) {
  const youtubeKey = Deno.env.get("YOUTUBE_API_KEY") ?? "";
  if (!youtubeKey.trim() || !captionForSearch.trim()) return null;
  const suggestion = await searchYoutubeRecipeVideo(
    youtubeKey,
    creatorHint,
    captionForSearch
  );
  if (!suggestion) return null;
  const result = await importFromUrl2(apiKey, suggestion.watchUrl, "youtube");
  if (!result || "notRecipe" in result && result.notRecipe) return null;
  return {
    recipe: result.recipe,
    cached: result.cached,
    channelTitle: suggestion.channelTitle,
    watchUrl: suggestion.watchUrl
  };
}

// supabase/functions/recipe-import/index.ts
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
var USER_WINDOW_MS = 6e4;
var USER_MAX_PER_WINDOW = 10;
var CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
var WEB_FETCH_TIMEOUT_MS = 12e3;
var WEB_MAX_BYTES = 15e5;
var WEB_MAX_TEXT_CHARS = 48e3;
var MAX_IMPORT_IMAGES = 4;
var FETCH_USER_AGENT = "MealPlanaticRecipeImport/1.0 (+https://mealplanatic.app; recipe-importer)";
var userHits = /* @__PURE__ */ new Map();
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
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
async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function readImportCache(urlKey) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return null;
  const hash = await sha256Hex(urlKey);
  const query = `${supabaseUrl}/rest/v1/recipe_import_cache?url_hash=eq.${encodeURIComponent(hash)}&select=payload,expires_at`;
  const response = await fetch(query, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  });
  if (!response.ok) return null;
  const rows = await response.json();
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row.payload;
}
async function writeImportCache(urlKey, sourceUrl, payload) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return;
  const hash = await sha256Hex(urlKey);
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
  await fetch(`${supabaseUrl}/rest/v1/recipe_import_cache`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify({
      url_hash: hash,
      source_url: sourceUrl,
      payload,
      expires_at: expiresAt
    })
  });
}
async function readResponseBodyLimited(response) {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks = [];
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
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}
async function fetchRecipePage(url) {
  let currentUrl = url;
  for (let hop = 0; hop <= RECIPE_FETCH_MAX_REDIRECTS; hop += 1) {
    const validated = validatePublicHttpFetchUrl(currentUrl);
    if (!validated.ok) return null;
    let response;
    try {
      response = await fetch(validated.url.toString(), {
        redirect: "manual",
        headers: {
          "User-Agent": FETCH_USER_AGENT,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"
        },
        signal: AbortSignal.timeout(WEB_FETCH_TIMEOUT_MS)
      });
    } catch {
      return null;
    }
    if (response.status >= 300 && response.status < 400) {
      if (hop >= RECIPE_FETCH_MAX_REDIRECTS) return null;
      const location = response.headers.get("location");
      if (!location) return null;
      const next = resolveRedirectLocation(validated.url, location);
      if (!next) return null;
      currentUrl = next;
      continue;
    }
    if (!response.ok) return null;
    return await readResponseBodyLimited(response);
  }
  return null;
}
function buildImportCacheKey(normalizedUrl, sourceType, captionText) {
  const base = sourceType === "youtube" ? canonicalYouTubeWatchUrl(normalizedUrl) : normalizedUrl;
  if (captionText?.trim()) {
    return urlHashKey(`${base}|caption|${captionText.trim()}`);
  }
  return urlHashKey(base);
}
function socialAuthorHandle(authorName) {
  const trimmed = authorName.trim();
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}
async function buildFallbackPayload(sourceType, hasCaption, captionForSearch, creatorHint) {
  const youtubeKey = Deno.env.get("YOUTUBE_API_KEY") ?? "";
  const youtubeSuggestion = await searchYoutubeRecipeVideo(
    youtubeKey,
    creatorHint,
    captionForSearch
  );
  const steps = orderImportFallbackSteps({
    sourceType,
    hasCaption,
    youtubeSuggestionAvailable: youtubeSuggestion != null
  });
  return {
    steps,
    youtubeSuggestion,
    message: "We could not find a complete recipe yet. Try one of these options."
  };
}
function recipeLooksValid(recipe) {
  return recipe.is_recipe && recipe.confidence >= 0.35 && (recipe.ingredients.length > 0 || recipe.steps.length > 0);
}
async function importFromCaption(apiKey, normalizedUrl, sourceType, captionText, socialMeta) {
  const cacheKey = buildImportCacheKey(normalizedUrl, sourceType, captionText);
  const cached = await readImportCache(cacheKey);
  if (cached) {
    return {
      recipe: {
        ...cached,
        source_url: normalizedUrl,
        social_author_name: socialMeta?.authorName ?? cached.social_author_name,
        social_author_url: socialMeta?.authorUrl ?? cached.social_author_url
      },
      cached: true
    };
  }
  const fromGemini = await extractRecipeFromPageText(apiKey, captionText, normalizedUrl, sourceType);
  if (!fromGemini) return null;
  if (!recipeLooksValid(fromGemini)) {
    return {
      notRecipe: true,
      message: "We could not find a recipe in that caption.",
      captionForSearch: captionText,
      creatorHint: socialMeta?.authorName ?? null
    };
  }
  const withSocial = {
    ...fromGemini,
    social_author_name: socialMeta?.authorName ?? null,
    social_author_url: socialMeta?.authorUrl ?? normalizedUrl
  };
  await writeImportCache(cacheKey, normalizedUrl, withSocial);
  return { recipe: withSocial, cached: false };
}
async function importFromUrl(apiKey, normalizedUrl, sourceType) {
  const cacheKey = buildImportCacheKey(normalizedUrl, sourceType);
  const cached = await readImportCache(cacheKey);
  if (cached) return { recipe: { ...cached, source_url: normalizedUrl }, cached: true };
  if (sourceType === "youtube") {
    const watchUrl = canonicalYouTubeWatchUrl(normalizedUrl);
    const extracted = await extractRecipeFromYouTubeVideo(apiKey, watchUrl, "youtube", normalizedUrl);
    if (!extracted) return null;
    if (!recipeLooksValid(extracted)) {
      return {
        notRecipe: true,
        message: "That video does not look like a recipe.",
        captionForSearch: extracted.title,
        creatorHint: extracted.youtube_channel_name ?? null
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
    if (fromLd && recipeLooksValid(fromLd)) {
      await writeImportCache(cacheKey, normalizedUrl, fromLd);
      return { recipe: fromLd, cached: false };
    }
  }
  const pageText = stripHtmlToText(html, WEB_MAX_TEXT_CHARS);
  const fromGemini = await extractRecipeFromPageText(apiKey, pageText, normalizedUrl);
  if (!fromGemini) return null;
  if (!recipeLooksValid(fromGemini)) {
    return {
      notRecipe: true,
      message: "We could not find a recipe on that page.",
      captionForSearch: pageText.slice(0, 400),
      creatorHint: null
    };
  }
  await writeImportCache(cacheKey, normalizedUrl, fromGemini);
  return { recipe: fromGemini, cached: false };
}
async function importTikTokLink(apiKey, normalizedUrl) {
  const oembed = await fetchTikTokOembed(normalizedUrl);
  if (!oembed) {
    return {
      notRecipe: true,
      message: "Could not read that TikTok post. Paste the caption or try a screenshot.",
      captionForSearch: "",
      creatorHint: null
    };
  }
  const authorLabel = socialAuthorHandle(oembed.authorName);
  return importFromCaption(apiKey, normalizedUrl, "tiktok", oembed.caption, {
    authorName: authorLabel,
    authorUrl: oembed.authorUrl ?? normalizedUrl
  });
}
function parseImportImages(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_IMPORT_IMAGES) return null;
  const allowed = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/webp"]);
  const out = [];
  for (const entry of raw) {
    const mime = (entry.mimeType ?? "image/jpeg").toLowerCase().split(";")[0].trim();
    const dataRaw = entry.data ?? "";
    const base64 = dataRaw.includes(",") ? dataRaw.split(",").pop() ?? "" : dataRaw;
    if (!allowed.has(mime) || !base64 || base64.length > 8e6) return null;
    out.push({ mimeType: mime, base64 });
  }
  return out;
}
async function maybeAttachAuthorPublicLink(recipe) {
  const youtubeKey = Deno.env.get("YOUTUBE_API_KEY") ?? "";
  if (!youtubeKey.trim()) return recipe;
  const suggestion = await searchYoutubeRecipeVideo(youtubeKey, null, recipe.title);
  if (!suggestion) return recipe;
  return { ...recipe, author_public_recipe_url: suggestion.watchUrl };
}
var MIN_TEXT_IMPORT_CHARS = 24;
async function importFromPlainText(apiKey, text) {
  const cacheKey = urlHashKey(`text|${text.slice(0, 4e3)}`);
  const cached = await readImportCache(cacheKey);
  if (cached) return { recipe: { ...cached, source_url: "text-import" }, cached: true };
  const fromGemini = await extractRecipeFromPageText(apiKey, text, "text-import", "web");
  if (!fromGemini) return null;
  if (!recipeLooksValid(fromGemini)) {
    return {
      notRecipe: true,
      message: "We could not find a recipe in that text.",
      captionForSearch: text.slice(0, 400),
      creatorHint: null
    };
  }
  await writeImportCache(cacheKey, "text-import", fromGemini);
  return { recipe: fromGemini, cached: false };
}
async function respondNotRecipeWithAutoYoutube(apiKey, sourceType, hasCaption, notRecipe) {
  const auto = await tryAutoImportFromYoutubeSearch(
    apiKey,
    importFromUrl,
    notRecipe.captionForSearch ?? "",
    notRecipe.creatorHint ?? null
  );
  if (auto) {
    return jsonResponse({
      recipe: auto.recipe,
      cached: auto.cached,
      autoResolvedViaYoutube: {
        channelTitle: auto.channelTitle,
        watchUrl: auto.watchUrl
      }
    });
  }
  const fallbacks = await buildFallbackPayload(
    sourceType,
    hasCaption,
    notRecipe.captionForSearch ?? "",
    notRecipe.creatorHint ?? null
  );
  return jsonResponse({ error: notRecipe.message, code: "NOT_RECIPE", fallbacks }, 422);
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
  if (!checkUserRateLimit(userId)) {
    return jsonResponse(
      { error: "Too many recipe imports. Wait a minute and try again.", code: "RATE_LIMIT" },
      429
    );
  }
  await cleanupStaleUserImportUploads(userId);
  const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!apiKey) {
    return jsonResponse(
      { error: "Recipe import is not set up yet. Ask an admin to finish setup.", code: "NOT_CONFIGURED" },
      503
    );
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body", code: "BAD_REQUEST" }, 400);
  }
  const action = body.action ?? "link";
  if (action === "confirm_youtube") {
    const yt = normalizeImportUrl(body.youtubeUrl ?? "");
    if (!yt || classifyRecipeImportUrl(yt) !== "youtube") {
      return jsonResponse({ error: "Invalid YouTube URL", code: "BAD_REQUEST" }, 400);
    }
    try {
      const result = await importFromUrl(apiKey, yt, "youtube");
      if (!result) {
        return jsonResponse({ error: "Could not import that YouTube video.", code: "UPSTREAM_ERROR" }, 502);
      }
      if ("notRecipe" in result && result.notRecipe) {
        const fallbacks = await buildFallbackPayload(
          "youtube",
          false,
          result.captionForSearch ?? "",
          result.creatorHint ?? null
        );
        return jsonResponse(
          { error: result.message, code: "NOT_RECIPE", fallbacks },
          422
        );
      }
      return jsonResponse({ recipe: result.recipe, cached: result.cached, confirmedYoutube: true });
    } catch (error) {
      console.error("recipe-import confirm_youtube error", error);
      return jsonResponse({ error: "Import failed unexpectedly.", code: "UPSTREAM_ERROR" }, 502);
    }
  }
  if (action === "text") {
    const text = (body.text ?? body.captionText ?? "").trim();
    if (text.length < MIN_TEXT_IMPORT_CHARS) {
      return jsonResponse({ error: "Paste a longer recipe or caption to import.", code: "BAD_REQUEST" }, 400);
    }
    try {
      const result = await importFromPlainText(apiKey, text);
      if (!result) {
        return jsonResponse({ error: "Could not import that text right now.", code: "UPSTREAM_ERROR" }, 502);
      }
      if ("notRecipe" in result && result.notRecipe) {
        return await respondNotRecipeWithAutoYoutube(apiKey, "text", true, result);
      }
      return jsonResponse({ recipe: result.recipe, cached: result.cached });
    } catch (error) {
      console.error("recipe-import text error", error);
      return jsonResponse({ error: "Import failed unexpectedly.", code: "UPSTREAM_ERROR" }, 502);
    }
  }
  if (action === "photo") {
    const storagePaths = (body.photoStoragePaths ?? []).map((path) => path.trim()).filter(Boolean);
    const pathsToCleanup = [...storagePaths];
    try {
      let images = null;
      if (storagePaths.length > 0) {
        if (!validatePhotoStoragePaths(userId, storagePaths)) {
          return jsonResponse({ error: "Invalid photo upload path.", code: "BAD_REQUEST" }, 400);
        }
        images = await downloadUserImportImages(userId, storagePaths);
        if (!images) {
          return jsonResponse({ error: "Could not read your uploaded photos.", code: "BAD_REQUEST" }, 400);
        }
      } else {
        images = parseImportImages(body.images);
        if (!images) {
          return jsonResponse({ error: "Add 1\u20134 recipe photos (JPEG/PNG/WebP).", code: "BAD_REQUEST" }, 400);
        }
      }
      const cacheKey = urlHashKey(
        `photo|${userId}|${images.map((i) => i.base64.slice(0, 64)).join("|")}`
      );
      const imageParts = images.map((img) => ({
        inline_data: { mime_type: img.mimeType, data: img.base64 }
      }));
      let extracted = await extractRecipeFromPhotos(apiKey, imageParts, "photo-scan");
      if (!extracted || !recipeLooksValid(extracted)) {
        const fallbacks = await buildFallbackPayload("photo", false, extracted?.title ?? "", null);
        return jsonResponse(
          {
            error: "We could not read a recipe from those photos.",
            code: "NOT_RECIPE",
            fallbacks
          },
          422
        );
      }
      extracted = await maybeAttachAuthorPublicLink(extracted);
      await writeImportCache(cacheKey, "photo-scan", extracted);
      return jsonResponse({ recipe: extracted, cached: false });
    } catch (error) {
      console.error("recipe-import photo error", error);
      return jsonResponse({ error: "Import failed unexpectedly.", code: "UPSTREAM_ERROR" }, 502);
    } finally {
      for (const path of pathsToCleanup) {
        await deleteUserImportObject(userId, path);
      }
    }
  }
  if (action === "screenshot") {
    const storagePaths = (body.photoStoragePaths ?? []).map((path) => path.trim()).filter(Boolean);
    const pathsToCleanup = [...storagePaths];
    try {
      let images = null;
      if (storagePaths.length > 0) {
        if (!validatePhotoStoragePaths(userId, storagePaths)) {
          return jsonResponse({ error: "Invalid screenshot upload path.", code: "BAD_REQUEST" }, 400);
        }
        images = await downloadUserImportImages(userId, storagePaths);
        if (!images) {
          return jsonResponse({ error: "Could not read your uploaded screenshots.", code: "BAD_REQUEST" }, 400);
        }
      } else {
        images = parseImportImages(body.images);
        if (!images) {
          return jsonResponse({ error: "Add 1\u20134 screenshots.", code: "BAD_REQUEST" }, 400);
        }
      }
      const normalized2 = normalizeImportUrl(body.url ?? "") ?? "screenshot-import";
      const sourceType2 = classifyRecipeImportUrl(normalized2) ?? "web";
      const imageParts = images.map((img) => ({
        inline_data: { mime_type: img.mimeType, data: img.base64 }
      }));
      const extracted = await extractRecipeFromScreenshots(
        apiKey,
        imageParts,
        normalized2,
        sourceType2 === "youtube" ? "web" : sourceType2
      );
      if (!extracted || !recipeLooksValid(extracted)) {
        const fallbacks = await buildFallbackPayload(String(sourceType2), Boolean(body.captionText?.trim()), "", null);
        return jsonResponse({ error: "No recipe found in those screenshots.", code: "NOT_RECIPE", fallbacks }, 422);
      }
      return jsonResponse({ recipe: extracted, cached: false });
    } catch (error) {
      console.error("recipe-import screenshot error", error);
      return jsonResponse({ error: "Import failed unexpectedly.", code: "UPSTREAM_ERROR" }, 502);
    } finally {
      for (const path of pathsToCleanup) {
        await deleteUserImportObject(userId, path);
      }
    }
  }
  if (action === "video") {
    const storagePath = (body.videoStoragePath ?? "").trim();
    if (!storagePath) {
      return jsonResponse({ error: "Missing video upload path.", code: "BAD_REQUEST" }, 400);
    }
    if (!validateUserImportStoragePath(userId, storagePath)) {
      return jsonResponse({ error: "Invalid video upload path.", code: "BAD_REQUEST" }, 400);
    }
    let geminiFileName = null;
    try {
      const downloaded = await downloadUserImportObject(userId, storagePath);
      if (!downloaded) {
        return jsonResponse({ error: "Could not read your uploaded video.", code: "BAD_REQUEST" }, 400);
      }
      let fileUri;
      if (shouldUseGeminiFileApi(downloaded.bytes.length)) {
        const uploaded = await uploadVideoToGeminiFiles(apiKey, downloaded.bytes, downloaded.mimeType);
        if (!uploaded) {
          return jsonResponse({ error: "Could not process that video.", code: "UPSTREAM_ERROR" }, 502);
        }
        fileUri = uploaded.fileUri;
        geminiFileName = uploaded.fileName;
      }
      const parts = buildGeminiPartsForVideo(
        downloaded.bytes,
        downloaded.mimeType,
        "",
        fileUri
      );
      const extracted = await extractRecipeFromUploadedVideo(apiKey, parts, storagePath);
      if (!extracted || !recipeLooksValid(extracted)) {
        const fallbacks = await buildFallbackPayload("video", false, extracted?.title ?? "", null);
        return jsonResponse({ error: "That video does not look like a recipe.", code: "NOT_RECIPE", fallbacks }, 422);
      }
      return jsonResponse({ recipe: extracted, cached: false });
    } catch (error) {
      console.error("recipe-import video error", error);
      return jsonResponse({ error: "Import failed unexpectedly.", code: "UPSTREAM_ERROR" }, 502);
    } finally {
      if (geminiFileName) {
        await deleteGeminiFile(apiKey, geminiFileName);
      }
      await deleteUserImportObject(userId, storagePath);
    }
  }
  const normalized = normalizeImportUrl(body.url ?? "");
  if (!normalized) {
    const fallbackText = (body.text ?? body.captionText ?? "").trim();
    if (fallbackText.length >= MIN_TEXT_IMPORT_CHARS) {
      try {
        const result = await importFromPlainText(apiKey, fallbackText);
        if (!result) {
          return jsonResponse({ error: "Could not import that text right now.", code: "UPSTREAM_ERROR" }, 502);
        }
        if ("notRecipe" in result && result.notRecipe) {
          return await respondNotRecipeWithAutoYoutube(apiKey, "text", true, result);
        }
        return jsonResponse({ recipe: result.recipe, cached: result.cached });
      } catch (error) {
        console.error("recipe-import text-via-link error", error);
        return jsonResponse({ error: "Import failed unexpectedly.", code: "UPSTREAM_ERROR" }, 502);
      }
    }
    return jsonResponse({ error: "Paste a link or recipe text to import.", code: "BAD_REQUEST" }, 400);
  }
  const sourceType = classifyRecipeImportUrl(normalized);
  if (!sourceType) {
    return jsonResponse({ error: "Unsupported URL", code: "BAD_REQUEST" }, 400);
  }
  if (sourceType === "tiktok") {
    const caption = (body.captionText ?? "").trim();
    try {
      const result = caption ? await importFromCaption(apiKey, normalized, "tiktok", caption, {
        authorUrl: normalized
      }) : await importTikTokLink(apiKey, normalized);
      if (!result) {
        return jsonResponse({ error: "Could not import that TikTok link.", code: "UPSTREAM_ERROR" }, 502);
      }
      if ("notRecipe" in result && result.notRecipe) {
        return await respondNotRecipeWithAutoYoutube(
          apiKey,
          "tiktok",
          Boolean(caption),
          result
        );
      }
      return jsonResponse({ recipe: result.recipe, cached: result.cached });
    } catch (error) {
      console.error("recipe-import tiktok error", error);
      return jsonResponse({ error: "Import failed unexpectedly.", code: "UPSTREAM_ERROR" }, 502);
    }
  }
  if (isManualCaptionSourceType(sourceType)) {
    const caption = (body.captionText ?? "").trim();
    if (!caption) {
      const fallbacks = await buildFallbackPayload(sourceType, false, "", null);
      return jsonResponse(
        {
          error: "Paste the post caption or upload a screenshot of the recipe.",
          code: "FALLBACK_REQUIRED",
          fallbacks
        },
        422
      );
    }
    try {
      const result = await importFromCaption(
        apiKey,
        normalized,
        sourceType,
        caption
      );
      if (!result) {
        return jsonResponse({ error: "Could not import that caption.", code: "UPSTREAM_ERROR" }, 502);
      }
      if ("notRecipe" in result && result.notRecipe) {
        return await respondNotRecipeWithAutoYoutube(apiKey, sourceType, true, result);
      }
      return jsonResponse({ recipe: result.recipe, cached: result.cached });
    } catch (error) {
      console.error("recipe-import caption error", error);
      return jsonResponse({ error: "Import failed unexpectedly.", code: "UPSTREAM_ERROR" }, 502);
    }
  }
  if ((body.captionText ?? "").trim()) {
    try {
      const result = await importFromCaption(
        apiKey,
        normalized,
        sourceType === "youtube" || sourceType === "web" ? "web" : sourceType,
        (body.captionText ?? "").trim()
      );
      if (result && !("notRecipe" in result && result.notRecipe)) {
        return jsonResponse({ recipe: result.recipe, cached: result.cached });
      }
    } catch {
    }
  }
  try {
    if (sourceType === "tiktok" || sourceType === "instagram" || sourceType === "facebook") {
      return jsonResponse({ error: "Unsupported link flow", code: "BAD_REQUEST" }, 400);
    }
    const result = await importFromUrl(apiKey, normalized, sourceType);
    if (!result) {
      return jsonResponse({ error: "Could not import that link right now.", code: "UPSTREAM_ERROR" }, 502);
    }
    if ("notRecipe" in result && result.notRecipe) {
      return await respondNotRecipeWithAutoYoutube(apiKey, sourceType, false, result);
    }
    return jsonResponse({ recipe: result.recipe, cached: result.cached });
  } catch (error) {
    console.error("recipe-import error", error);
    return jsonResponse({ error: "Import failed unexpectedly.", code: "UPSTREAM_ERROR" }, 502);
  }
});
