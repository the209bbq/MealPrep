// AUTO-GENERATED single-file bundle for pasting into the Supabase dashboard. Source: supabase/functions/recipe-import/
// supabase/functions/recipe-import/safeHttpUrl.ts
var BLOCKED_SCHEME_PREFIXES = ["javascript:", "data:", "vbscript:", "file:"];
function isAllowedHttpUrlString(url) {
  const trimmed = url.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  for (const blocked of BLOCKED_SCHEME_PREFIXES) {
    if (lower.startsWith(blocked)) return false;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.username || parsed.password) return false;
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
function sanitizeHttpUrl(url) {
  if (url == null) return null;
  const trimmed = url.trim();
  if (!trimmed || !isAllowedHttpUrlString(trimmed)) return null;
  return trimmed;
}
function resolveAndSanitizeHttpUrl(url, pageUrl) {
  if (url == null) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const absolute = new URL(trimmed, pageUrl).href;
    return sanitizeHttpUrl(absolute);
  } catch {
    return null;
  }
}

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

// supabase/functions/recipe-import/textRecipeParse.ts
var INGREDIENT_HEADINGS = /^(#{1,3}\s*)?(ingredients?|what you(?:'ll| will) need|shopping list)\s*:?\s*$/i;
var STEP_HEADINGS = /^(#{1,3}\s*)?(instructions?|directions?|method|steps?|how to make|preparation)\s*:?\s*$/i;
var BULLET_LINE = /^\s*(?:[-*•]|\d+[.)])\s+(.+)$/;
var QUANTITY_INGREDIENT = /^([\d¼½¾⅓⅔⅛⅜⅝⅞./\s]+)?\s*([a-zA-Z]+(?:\.|\/[a-zA-Z]+)?)?\s+(.+)$/;
function decodeHtmlEntities(text) {
  return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
function normalizeRecipeText(raw) {
  return decodeHtmlEntities(raw).replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").trim();
}
function parseIngredientLine(line) {
  const cleaned = line.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
  if (!cleaned || cleaned.length < 2) return null;
  const qtyMatch = cleaned.match(/^([\d¼½¾⅓⅔⅛⅜⅝⅞./\s-]+)\s+(\S+)\s+(.+)$/);
  if (qtyMatch) {
    const qtyRaw = qtyMatch[1].trim();
    const unit = qtyMatch[2].trim();
    const name = qtyMatch[3].trim();
    const quantity = parseQuantityToken(qtyRaw);
    if (name.length > 0) {
      return { name, quantity, unit };
    }
  }
  const loose = cleaned.match(QUANTITY_INGREDIENT);
  if (loose && loose[3]) {
    const quantity = parseQuantityToken((loose[1] ?? "1").trim());
    const unit = (loose[2] ?? "each").trim();
    const name = loose[3].trim();
    if (name.length > 1) {
      return { name, quantity, unit: unit || "each" };
    }
  }
  return { name: cleaned, quantity: 1, unit: "each" };
}
function parseQuantityToken(raw) {
  const map = {
    "\xBC": 0.25,
    "\xBD": 0.5,
    "\xBE": 0.75,
    "\u2153": 1 / 3,
    "\u2154": 2 / 3,
    "\u215B": 0.125
  };
  let text = raw.trim();
  for (const [sym, val] of Object.entries(map)) {
    text = text.replace(sym, ` ${val} `);
  }
  if (text.includes("/")) {
    const parts = text.split(/\s+/).filter(Boolean);
    let sum = 0;
    for (const part of parts) {
      if (part.includes("/")) {
        const [a, b] = part.split("/").map((x) => Number.parseFloat(x));
        if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) sum += a / b;
      } else {
        const n2 = Number.parseFloat(part);
        if (Number.isFinite(n2)) sum += n2;
      }
    }
    if (sum > 0) return sum;
  }
  const n = Number.parseFloat(text);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
function splitSections(lines) {
  const ingredients = [];
  const steps = [];
  let mode = "none";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (INGREDIENT_HEADINGS.test(trimmed)) {
      mode = "ingredients";
      continue;
    }
    if (STEP_HEADINGS.test(trimmed)) {
      mode = "steps";
      continue;
    }
    const bullet = BULLET_LINE.exec(trimmed);
    const content = bullet ? bullet[1].trim() : trimmed;
    if (mode === "ingredients") {
      ingredients.push(content);
    } else if (mode === "steps") {
      steps.push(content);
    } else if (bullet) {
      if (steps.length > 0 || ingredients.length >= 3) {
        steps.push(content);
      } else {
        ingredients.push(content);
      }
    } else if (/^\d+[.)]\s/.test(trimmed)) {
      steps.push(content);
    }
  }
  return { ingredients, steps };
}
function recipeSignalsInText(text) {
  const normalized = normalizeRecipeText(text);
  if (!normalized) return false;
  const lower = normalized.toLowerCase();
  if (INGREDIENT_HEADINGS.test(lower.split("\n")[0] ?? "")) return true;
  if (STEP_HEADINGS.test(lower)) return true;
  const lines = normalized.split("\n").map((l) => l.trim()).filter(Boolean);
  const { ingredients, steps } = splitSections(lines);
  return ingredients.length >= 2 && steps.length >= 1;
}
function parseRuleBasedRecipeFromText(title, body) {
  const recipeTitle = title.trim();
  const normalizedBody = normalizeRecipeText(body);
  if (!recipeTitle || !normalizedBody) return null;
  const lines = normalizedBody.split("\n");
  const { ingredients: ingLines, steps: stepLines } = splitSections(lines);
  const ingredients = [];
  for (const line of ingLines) {
    const parsed = parseIngredientLine(line);
    if (parsed) ingredients.push(parsed);
  }
  const steps = stepLines.map((s) => s.replace(/^\d+[.)]\s*/, "").trim()).filter((s) => s.length > 2);
  if (ingredients.length < 2 || steps.length < 1) {
    return null;
  }
  const servingsMatch = normalizedBody.match(/(?:servings?|serves?)\s*:?\s*(\d+)/i);
  const servings = servingsMatch ? Math.max(1, Number.parseInt(servingsMatch[1], 10)) : 4;
  return {
    title: recipeTitle,
    servings,
    ingredients,
    steps,
    is_recipe: true,
    confidence: 0.72
  };
}

// supabase/functions/recipe-import/redditImport.ts
var REDDIT_FETCH_USER_AGENT = "MealPlanaticRecipeImport/1.0 (+https://mealplanatic.app; reddit-recipe-importer)";
var REDDIT_HOSTS = /* @__PURE__ */ new Set([
  "reddit.com",
  "www.reddit.com",
  "old.reddit.com",
  "m.reddit.com",
  "redd.it",
  "www.redd.it"
]);
var RedditImportError = class extends Error {
  code;
  userMessage;
  constructor(code, userMessage) {
    super(userMessage);
    this.code = code;
    this.userMessage = userMessage;
  }
};
function isRedditImportHostname(host) {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (REDDIT_HOSTS.has(h)) return true;
  return h.endsWith(".reddit.com");
}
function parseRedditUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }
  if (!isRedditImportHostname(url.hostname)) return null;
  if (url.hostname.replace(/^www\./, "") === "redd.it") {
    const id = url.pathname.replace(/^\//, "").split("/")[0];
    return id ? { postId: id } : null;
  }
  const shareMatch = url.pathname.match(/^\/r\/[^/]+\/s\/([A-Za-z0-9]+)\/?$/i);
  if (shareMatch) {
    return { sharePath: url.pathname };
  }
  const commentsMatch = url.pathname.match(/\/comments\/([a-z0-9]+)/i);
  if (commentsMatch) {
    return { postId: commentsMatch[1] };
  }
  return null;
}
function buildRedditCommentsJsonUrl(postId) {
  return `https://www.reddit.com/comments/${postId}.json?limit=20`;
}
function redditCreditLabel(author, subreddit) {
  const user = author.startsWith("u/") ? author : `u/${author}`;
  const sub = subreddit.startsWith("r/") ? subreddit : `r/${subreddit}`;
  return `${user} on ${sub}`;
}
function redditAuthorProfileUrl(author) {
  const name = author.replace(/^\/?u\//i, "");
  return `https://www.reddit.com/user/${encodeURIComponent(name)}`;
}
function decodeRedditUrl(raw) {
  if (!raw?.trim()) return null;
  const decoded = raw.replace(/&amp;/g, "&").trim();
  return sanitizeHttpUrl(decoded);
}
function readPostListingPayload(json) {
  if (!Array.isArray(json) || json.length < 1) return null;
  const listing = json[0];
  const child = listing.data?.children?.[0];
  return child?.data ?? null;
}
function readCommentListing(json) {
  if (!Array.isArray(json) || json.length < 2) return [];
  const listing = json[1];
  const children = listing.data?.children ?? [];
  const rows = [];
  for (const node of children) {
    const row = node;
    if (row.kind !== "t1" || !row.data) continue;
    const author = typeof row.data.author === "string" ? row.data.author : "";
    const body = typeof row.data.body === "string" ? row.data.body : "";
    const score = typeof row.data.score === "number" ? row.data.score : 0;
    const parentId = typeof row.data.parent_id === "string" ? row.data.parent_id : "";
    if (!author || !body || author === "[deleted]") continue;
    rows.push({ author, body, score, parentId });
  }
  return rows;
}
function redditPostFromListingJson(json, fallbackPostId) {
  const data = readPostListingPayload(json);
  if (!data) return null;
  const postId = typeof data.id === "string" && data.id || fallbackPostId || "";
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const selftext = typeof data.selftext === "string" ? data.selftext : "";
  const author = typeof data.author === "string" ? data.author : "";
  const subreddit = typeof data.subreddit === "string" ? data.subreddit : "";
  const permalink = typeof data.permalink === "string" ? data.permalink : "";
  const isSelf = data.is_self === true;
  const over18 = data.over_18 === true;
  const removedBy = typeof data.removed_by_category === "string" ? data.removed_by_category : null;
  const removed = author === "[deleted]" || Boolean(removedBy) || data.removed === true || data.removed_by === "moderator";
  const urlField = typeof data.url === "string" ? data.url : null;
  const urlOverridden = typeof data.url_overridden_by_dest === "string" ? data.url_overridden_by_dest : null;
  const externalUrl = !isSelf ? decodeRedditUrl(urlOverridden ?? urlField) : null;
  let imageUrl = null;
  const preview = data.preview;
  const previewUrl = preview?.images?.[0]?.source?.url;
  imageUrl = decodeRedditUrl(previewUrl);
  if (!imageUrl && urlField && !isSelf) {
    const maybeImage = decodeRedditUrl(urlField);
    if (maybeImage && /\.(jpe?g|png|gif|webp)(\?|$)/i.test(maybeImage)) {
      imageUrl = maybeImage;
    }
  }
  const gallery = data.media_metadata;
  if (!imageUrl && gallery && typeof gallery === "object") {
    for (const key of Object.keys(gallery)) {
      const u = gallery[key]?.s?.u;
      const decoded = decodeRedditUrl(u);
      if (decoded) {
        imageUrl = decoded;
        break;
      }
    }
  }
  const canonicalPostUrl = permalink ? `https://www.reddit.com${permalink.startsWith("/") ? permalink : `/${permalink}`}` : `https://www.reddit.com/comments/${postId}/`;
  return {
    postId,
    permalink,
    canonicalPostUrl,
    title,
    selftext,
    author,
    subreddit,
    isSelf,
    over18,
    externalUrl,
    imageUrl,
    removed
  };
}
function selectRecipeBodyText(post, comments) {
  const candidates = [];
  if (post.selftext.trim()) candidates.push(post.selftext);
  const postFullname = `t3_${post.postId}`;
  const topLevel = comments.filter((c) => c.parentId === postFullname);
  const opComments = topLevel.filter((c) => c.author === post.author).sort((a, b) => b.score - a.score);
  for (const c of opComments) candidates.push(c.body);
  const topComment = [...topLevel].sort((a, b) => b.score - a.score)[0];
  if (topComment && !opComments.includes(topComment)) {
    candidates.push(topComment.body);
  }
  for (const text of candidates) {
    if (recipeSignalsInText(text)) return text;
  }
  return candidates[0] ?? "";
}
function isExternalRecipeLink(post) {
  if (post.isSelf || !post.externalUrl) return false;
  try {
    const host = new URL(post.externalUrl).hostname.toLowerCase();
    if (isRedditImportHostname(host) || host.endsWith(".reddit.com")) return false;
    if (/^(i\.)?redd\.it$/i.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}
function assertRedditPostImportable(post) {
  if (post.removed || post.author === "[deleted]") {
    throw new RedditImportError(
      "REDDIT_DELETED",
      "That Reddit post was deleted or removed, so we cannot import a recipe from it."
    );
  }
  if (post.over18) {
    throw new RedditImportError(
      "REDDIT_NSFW",
      "That Reddit post is marked NSFW. We cannot import recipes from NSFW posts."
    );
  }
}
function mergeRuleParsedRecipe(parsed, post) {
  if (!parsed) return null;
  const credit = redditCreditLabel(post.author, post.subreddit);
  return {
    ...parsed,
    prep_minutes: null,
    cook_minutes: null,
    source_url: post.canonicalPostUrl,
    source_type: "reddit",
    social_author_name: credit,
    social_author_url: redditAuthorProfileUrl(post.author),
    image_url: post.imageUrl
  };
}
async function resolveRedditShareLink(shareUrl, fetchFn, userAgent) {
  let currentUrl = shareUrl;
  for (let hop = 0; hop <= RECIPE_FETCH_MAX_REDIRECTS; hop += 1) {
    const validated = validatePublicHttpFetchUrl(currentUrl);
    if (!validated.ok) return null;
    let response;
    try {
      response = await fetchFn(validated.url.toString(), {
        redirect: "manual",
        headers: { "User-Agent": userAgent, Accept: "text/html,*/*" }
      });
    } catch {
      return null;
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      const next = resolveRedirectLocation(validated.url, location);
      if (!next) return null;
      currentUrl = next;
      continue;
    }
    if (response.status === 403 || response.status === 404) return null;
    return currentUrl;
  }
  return null;
}
async function fetchRedditListingJson(postId, fetchFn, userAgent) {
  const url = buildRedditCommentsJsonUrl(postId);
  const validated = validatePublicHttpFetchUrl(url);
  if (!validated.ok) {
    throw new RedditImportError("REDDIT_BAD_LINK", "That Reddit link is not valid.");
  }
  let response;
  try {
    response = await fetchFn(validated.url.toString(), {
      headers: { "User-Agent": userAgent, Accept: "application/json" },
      signal: AbortSignal.timeout(12e3)
    });
  } catch {
    throw new RedditImportError(
      "REDDIT_BAD_LINK",
      "Could not reach Reddit right now. Try again in a moment."
    );
  }
  if (response.status === 403 || response.status === 401) {
    throw new RedditImportError(
      "REDDIT_PRIVATE",
      "That Reddit post is private or unavailable."
    );
  }
  if (!response.ok) {
    throw new RedditImportError(
      "REDDIT_BAD_LINK",
      "Could not read that Reddit post."
    );
  }
  return await response.json();
}
async function resolveRedditPostIdFromUrl(normalizedUrl, fetchFn, userAgent) {
  const parsed = parseRedditUrl(normalizedUrl);
  if (!parsed) {
    throw new RedditImportError("REDDIT_BAD_LINK", "Paste a valid Reddit post link.");
  }
  if ("postId" in parsed) return parsed.postId;
  const resolved = await resolveRedditShareLink(
    new URL(normalizedUrl).origin + parsed.sharePath,
    fetchFn,
    userAgent
  );
  if (!resolved) {
    throw new RedditImportError("REDDIT_BAD_LINK", "Could not open that Reddit share link.");
  }
  const fromResolved = parseRedditUrl(resolved);
  if (fromResolved && "postId" in fromResolved) return fromResolved.postId;
  throw new RedditImportError("REDDIT_BAD_LINK", "That Reddit share link did not resolve to a post.");
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
  if (isRedditImportHostname(host)) return "reddit";
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
  const authorUrlRaw = typeof obj.author_url === "string" && obj.author_url.trim() ? obj.author_url.trim() : null;
  const authorUrl = authorUrlRaw ? sanitizeHttpUrl(authorUrlRaw) : null;
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
  "gemini-2.5-flash"
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
  if (sourceType === "tiktok" || sourceType === "instagram" || sourceType === "facebook" || sourceType === "reddit") {
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
var YOUTUBE_EXTRACTION_PROMPT = "You are helping a meal-planning app. The video is referenced by URL only \u2014 do not download, store, or reproduce the video or audio. Watch the cooking video and extract a recipe with clear step-by-step INSTRUCTIONS and ingredients with quantities and units. Rewrite the dish title, ingredients, and steps in fresh wording (never copy the video title, description, or transcript verbatim). Leave youtube_channel_name null (channel attribution is added separately). Use generic ingredient names (no brands). If this is not a recipe video, set is_recipe false with a low confidence score.";
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
async function callGeminiWithFallback(apiKey, parts, options) {
  const budget = new RequestTimeBudget(GEMINI_REQUEST_TOTAL_BUDGET_MS);
  const allCandidates = orderModelsForAttempt(
    Deno.env.get("GEMINI_MODEL") ?? void 0,
    Deno.env.get("GEMINI_FALLBACK_MODELS") ?? void 0,
    geminiModelTimeoutMemory
  );
  const candidates = options?.singleModelAttempt ? allCandidates.slice(0, 1) : allCandidates;
  const maxHttpRetries = options?.singleModelAttempt ? 1 : GEMINI_HTTP_RETRIES_PER_MODEL;
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
      if (shouldRetrySameModelAfterError(result.error, httpRetries, maxHttpRetries)) {
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
async function extractRecipeFromPageText(apiKey, pageText, sourceUrl, sourceType = "web", options) {
  const prompt = sourceType === "tiktok" || sourceType === "instagram" || sourceType === "facebook" ? SOCIAL_CAPTION_PROMPT : TEXT_EXTRACTION_PROMPT;
  const parts = [
    {
      text: `${prompt}

Source URL: ${sourceUrl}

Text:
${pageText}`
    }
  ];
  const extracted = await callGeminiWithFallback(apiKey, parts, options);
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
function parseIngredientLine2(text) {
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
    const parsed = parseIngredientLine2(amount);
    return { ...parsed, name: name || parsed.name };
  }
  return parseIngredientLine2(name);
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
        const parsed = parseIngredientLine2(entry);
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

// supabase/functions/recipe-import/pageAuthorMeta.ts
function readMetaContent(html, attr, key) {
  const pattern = new RegExp(
    `<meta[^>]+${attr}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
    "i"
  );
  const tag = html.match(pattern)?.[0];
  if (!tag) return null;
  const content = tag.match(/\bcontent=["']([^"']+)["']/i)?.[1];
  return content?.trim() ? content.trim() : null;
}
function readJsonLdAuthor(html, pageUrl) {
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (!scripts) return null;
  for (const block of scripts) {
    const inner = block.replace(/^[\s\S]*?>/i, "").replace(/<\/script>$/i, "").trim();
    if (!inner) continue;
    try {
      const parsed = JSON.parse(inner);
      const found = walkJsonLdForAuthor(parsed, pageUrl);
      if (found) return found;
    } catch {
      continue;
    }
  }
  return null;
}
function authorFromJsonLdNode(node, pageUrl) {
  const author = node.author ?? node.creator;
  if (typeof author === "string" && author.trim()) {
    return { authorName: author.trim(), authorUrl: null };
  }
  if (author && typeof author === "object") {
    const row = author;
    const name = typeof row.name === "string" && row.name.trim() || typeof row["@name"] === "string" && row["@name"].trim() || null;
    const rawUrl = typeof row.url === "string" && row.url.trim() || typeof row["@id"] === "string" && row["@id"].trim() || null;
    const authorUrl = rawUrl ? resolveAndSanitizeHttpUrl(rawUrl, pageUrl) : null;
    if (name) return { authorName: name, authorUrl };
  }
  return null;
}
function walkJsonLdForAuthor(value, pageUrl) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = walkJsonLdForAuthor(entry, pageUrl);
      if (found) return found;
    }
    return null;
  }
  const obj = value;
  const direct = authorFromJsonLdNode(obj, pageUrl);
  if (direct) return direct;
  if (Array.isArray(obj["@graph"])) {
    for (const entry of obj["@graph"]) {
      const found = walkJsonLdForAuthor(entry, pageUrl);
      if (found) return found;
    }
  }
  return null;
}
function extractPageAuthorFromHtml(html, pageUrl) {
  const fromLd = readJsonLdAuthor(html, pageUrl);
  if (fromLd) return fromLd;
  const articleAuthor = readMetaContent(html, "property", "article:author");
  if (articleAuthor) {
    const safeAuthorUrl = sanitizeHttpUrl(articleAuthor);
    const name = safeAuthorUrl ? readMetaContent(html, "name", "author") ?? articleAuthor : articleAuthor;
    const url = safeAuthorUrl;
    if (name.trim()) return { authorName: name.trim(), authorUrl: url };
  }
  const metaAuthor = readMetaContent(html, "name", "author");
  if (metaAuthor?.trim()) {
    return { authorName: metaAuthor.trim(), authorUrl: null };
  }
  const siteName = readMetaContent(html, "property", "og:site_name");
  if (siteName?.trim()) {
    return { authorName: siteName.trim(), authorUrl: null };
  }
  return null;
}

// supabase/functions/recipe-import/youtubeCreatorMeta.ts
function youtubeVideoIdFromImportUrl(urlString) {
  try {
    const canonical = canonicalYouTubeWatchUrl(urlString);
    const parsed = new URL(canonical);
    const v = parsed.searchParams.get("v");
    if (v && /^[\w-]{6,}$/.test(v)) return v;
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      if (id) return id;
    }
    const shorts = parsed.pathname.match(/\/shorts\/([\w-]+)/);
    if (shorts?.[1]) return shorts[1];
  } catch {
    return null;
  }
  return null;
}
function parseYouTubeOembedPayload(raw) {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw;
  const channelName = typeof obj.author_name === "string" && obj.author_name.trim() ? obj.author_name.trim() : null;
  const channelUrl = typeof obj.author_url === "string" && obj.author_url.trim() ? obj.author_url.trim() : null;
  const safeUrl = channelUrl ? sanitizeHttpUrl(channelUrl) : null;
  if (!channelName || !safeUrl) return null;
  return { channelName, channelUrl: safeUrl };
}
async function fetchYouTubeCreatorFromOembed(pageUrl) {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(pageUrl)}&format=json`;
  let response;
  try {
    response = await fetch(endpoint, { signal: AbortSignal.timeout(12e3) });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  try {
    const json = await response.json();
    return parseYouTubeOembedPayload(json);
  } catch {
    return null;
  }
}
async function fetchYouTubeCreatorFromVideosApi(apiKey, videoId) {
  if (!apiKey.trim() || !videoId) return null;
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", apiKey);
  let response;
  try {
    response = await fetch(url.toString(), { signal: AbortSignal.timeout(12e3) });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const body = await response.json();
  const snippet = body.items?.[0]?.snippet;
  const channelTitle = snippet?.channelTitle?.trim() ?? "";
  const channelId = snippet?.channelId?.trim() ?? "";
  if (!channelTitle || !channelId) return null;
  return {
    channelName: channelTitle,
    channelUrl: `https://www.youtube.com/channel/${channelId}`
  };
}
async function resolveYouTubeCreatorMeta(normalizedUrl, watchUrl) {
  const oembed = await fetchYouTubeCreatorFromOembed(normalizedUrl) ?? await fetchYouTubeCreatorFromOembed(watchUrl);
  if (oembed) return oembed;
  const apiKey = Deno.env.get("YOUTUBE_API_KEY") ?? "";
  const videoId = youtubeVideoIdFromImportUrl(watchUrl);
  if (!videoId) return null;
  return await fetchYouTubeCreatorFromVideosApi(apiKey, videoId);
}

// supabase/functions/recipe-import/creatorAttribution.ts
function recipeMissingCreatorFields(recipe, sourceType) {
  if (sourceType === "youtube") {
    return !recipe.youtube_channel_name?.trim() || !recipe.youtube_channel_url?.trim();
  }
  if (sourceType === "tiktok" || sourceType === "instagram" || sourceType === "facebook" || sourceType === "reddit" || sourceType === "web") {
    return !recipe.social_author_name?.trim();
  }
  return false;
}
function applyYouTubeCreatorMeta(recipe, meta) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const channelUrl = sanitizeHttpUrl(meta.channelUrl);
  return {
    ...recipe,
    youtube_channel_name: meta.channelName,
    youtube_channel_url: channelUrl,
    metadata_refreshed_at: now,
    social_author_name: meta.channelName,
    social_author_url: channelUrl
  };
}
function applySocialAuthorMeta(recipe, meta) {
  const authorUrl = sanitizeHttpUrl(meta.authorUrl) ?? sanitizeHttpUrl(recipe.source_url);
  return {
    ...recipe,
    social_author_name: meta.authorName,
    social_author_url: authorUrl
  };
}
async function enrichYouTubeRecipeCreator(recipe, normalizedUrl, watchUrl) {
  if (!recipeMissingCreatorFields(recipe, "youtube")) return recipe;
  const meta = await resolveYouTubeCreatorMeta(normalizedUrl, watchUrl);
  if (!meta) return recipe;
  return applyYouTubeCreatorMeta(recipe, meta);
}
async function enrichWebRecipeCreator(recipe, html) {
  if (!recipeMissingCreatorFields(recipe, "web")) return recipe;
  const pageUrl = recipe.source_url?.trim();
  if (!pageUrl) return recipe;
  const meta = extractPageAuthorFromHtml(html, pageUrl);
  if (!meta) return recipe;
  return applySocialAuthorMeta(recipe, meta);
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
  const apiKeyYt = Deno.env.get("YOUTUBE_API_KEY") ?? "";
  const fromApi = await fetchYouTubeCreatorFromVideosApi(apiKeyYt, suggestion.videoId);
  let recipe = result.recipe;
  if (fromApi) {
    recipe = applyYouTubeCreatorMeta(recipe, fromApi);
  } else {
    recipe = await enrichYouTubeRecipeCreator(recipe, suggestion.watchUrl, suggestion.watchUrl);
  }
  return {
    recipe,
    cached: result.cached,
    channelTitle: recipe.youtube_channel_name ?? suggestion.channelTitle,
    watchUrl: suggestion.watchUrl
  };
}

// supabase/functions/recipe-import/recipeImageMeta.ts
function youtubeHqDefaultThumbnailUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId.trim()}/hqdefault.jpg`;
}
function readMetaContent2(html, attr, key) {
  const pattern = new RegExp(
    `<meta[^>]+${attr}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
    "i"
  );
  const tag = html.match(pattern)?.[0];
  if (!tag) return null;
  const content = tag.match(/\bcontent=["']([^"']+)["']/i)?.[1];
  return content?.trim() ? content.trim() : null;
}
function extractOgImageFromHtml(html, pageUrl) {
  const raw = readMetaContent2(html, "property", "og:image") ?? readMetaContent2(html, "property", "og:image:url") ?? readMetaContent2(html, "name", "twitter:image");
  if (!raw) return null;
  return resolveAndSanitizeHttpUrl(raw, pageUrl);
}
function resolveYouTubeImportImageUrl(normalizedUrl, watchUrl, oembedThumbnail) {
  const fromOembed = sanitizeImportImageUrl(oembedThumbnail, watchUrl);
  if (fromOembed) return fromOembed;
  const videoId = youtubeVideoIdFromImportUrl(normalizedUrl) ?? youtubeVideoIdFromImportUrl(watchUrl);
  if (videoId) return youtubeHqDefaultThumbnailUrl(videoId);
  return null;
}
function sanitizeImportImageUrl(url, pageUrl) {
  if (url == null || !url.trim()) return null;
  if (pageUrl?.trim()) {
    const resolved = resolveAndSanitizeHttpUrl(url, pageUrl);
    if (resolved) return resolved;
  }
  return sanitizeHttpUrl(url);
}
function withImportImageUrl(recipe, imageUrl, pageUrl) {
  const safe = sanitizeImportImageUrl(imageUrl, pageUrl);
  if (!safe) return recipe;
  return { ...recipe, image_url: safe };
}
function imageUrlForCachedImport(recipe, sourceType, normalizedUrl) {
  const stored = sanitizeHttpUrl(recipe.image_url);
  if (stored) return stored;
  if (sourceType === "youtube") {
    return resolveYouTubeImportImageUrl(normalizedUrl, normalizedUrl, null);
  }
  return null;
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
async function backfillCachedRecipeCreator(cacheKey, normalizedUrl, sourceType, cached, htmlForWeb) {
  if (!recipeMissingCreatorFields(cached, sourceType)) {
    return cached;
  }
  let enriched = cached;
  if (sourceType === "youtube") {
    const watchUrl = canonicalYouTubeWatchUrl(normalizedUrl);
    enriched = await enrichYouTubeRecipeCreator(cached, normalizedUrl, watchUrl);
  } else if (sourceType === "web" && htmlForWeb) {
    enriched = await enrichWebRecipeCreator(cached, htmlForWeb);
  }
  if (enriched !== cached) {
    await writeImportCache(cacheKey, normalizedUrl, enriched);
  }
  return enriched;
}
async function importFromCaption(apiKey, normalizedUrl, sourceType, captionText, socialMeta) {
  const cacheKey = buildImportCacheKey(normalizedUrl, sourceType, captionText);
  const cached = await readImportCache(cacheKey);
  if (cached) {
    const backfilled = await backfillCachedRecipeCreator(
      cacheKey,
      normalizedUrl,
      sourceType,
      cached
    );
    return {
      recipe: withImportImageUrl(
        {
          ...backfilled,
          source_url: normalizedUrl,
          social_author_name: socialMeta?.authorName ?? backfilled.social_author_name,
          social_author_url: socialMeta?.authorUrl ?? backfilled.social_author_url
        },
        socialMeta?.thumbnailUrl ?? backfilled.image_url ?? imageUrlForCachedImport(backfilled, sourceType, normalizedUrl),
        normalizedUrl
      ),
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
  const withSocial = withImportImageUrl(
    {
      ...fromGemini,
      social_author_name: socialMeta?.authorName ?? null,
      social_author_url: socialMeta?.authorUrl ?? normalizedUrl
    },
    socialMeta?.thumbnailUrl,
    normalizedUrl
  );
  await writeImportCache(cacheKey, normalizedUrl, withSocial);
  return { recipe: withSocial, cached: false };
}
async function importFromUrl(apiKey, normalizedUrl, sourceType) {
  const cacheKey = buildImportCacheKey(normalizedUrl, sourceType);
  const cached = await readImportCache(cacheKey);
  if (cached) {
    const html2 = sourceType === "web" && recipeMissingCreatorFields(cached, "web") ? await fetchRecipePage(normalizedUrl) : null;
    const backfilled = await backfillCachedRecipeCreator(
      cacheKey,
      normalizedUrl,
      sourceType,
      cached,
      html2
    );
    const withImage2 = withImportImageUrl(
      { ...backfilled, source_url: normalizedUrl },
      backfilled.image_url ?? imageUrlForCachedImport(backfilled, sourceType, normalizedUrl),
      normalizedUrl
    );
    return { recipe: withImage2, cached: true };
  }
  if (sourceType === "youtube") {
    const watchUrl = canonicalYouTubeWatchUrl(normalizedUrl);
    const extracted = await extractRecipeFromYouTubeVideo(apiKey, watchUrl, "youtube", normalizedUrl);
    if (!extracted) return null;
    const withCreator = await enrichYouTubeRecipeCreator(extracted, normalizedUrl, watchUrl);
    const imageUrl = resolveYouTubeImportImageUrl(normalizedUrl, watchUrl, null);
    const withImage2 = withImportImageUrl(withCreator, imageUrl, watchUrl);
    if (!recipeLooksValid(withImage2)) {
      const creatorHint = withCreator.youtube_channel_name ?? withCreator.social_author_name ?? null;
      return {
        notRecipe: true,
        message: "That video does not look like a recipe.",
        captionForSearch: withCreator.title,
        creatorHint
      };
    }
    await writeImportCache(cacheKey, normalizedUrl, withImage2);
    return { recipe: withImage2, cached: false };
  }
  const html = await fetchRecipePage(normalizedUrl);
  if (!html) return null;
  const jsonLd = findRecipeJsonLdInHtml(html);
  if (jsonLd) {
    const fromLd = recipeJsonLdToExtracted(jsonLd, normalizedUrl);
    if (fromLd && recipeLooksValid(fromLd)) {
      const withAuthor2 = await enrichWebRecipeCreator(fromLd, html);
      const withImage2 = withImportImageUrl(withAuthor2, extractOgImageFromHtml(html, normalizedUrl), normalizedUrl);
      await writeImportCache(cacheKey, normalizedUrl, withImage2);
      return { recipe: withImage2, cached: false };
    }
  }
  const pageText = stripHtmlToText(html, WEB_MAX_TEXT_CHARS);
  const fromGemini = await extractRecipeFromPageText(apiKey, pageText, normalizedUrl);
  if (!fromGemini) return null;
  const withAuthor = await enrichWebRecipeCreator(fromGemini, html);
  const withImage = withImportImageUrl(withAuthor, extractOgImageFromHtml(html, normalizedUrl), normalizedUrl);
  if (!recipeLooksValid(withImage)) {
    return {
      notRecipe: true,
      message: "We could not find a recipe on that page.",
      captionForSearch: pageText.slice(0, 400),
      creatorHint: withImage.social_author_name ?? null
    };
  }
  await writeImportCache(cacheKey, normalizedUrl, withImage);
  return { recipe: withImage, cached: false };
}
async function importRedditLink(apiKey, normalizedUrl) {
  const cacheKey = buildImportCacheKey(normalizedUrl, "reddit");
  const cached = await readImportCache(cacheKey);
  if (cached) {
    return {
      recipe: withImportImageUrl(
        { ...cached, source_url: cached.source_url || normalizedUrl },
        cached.image_url ?? imageUrlForCachedImport(cached, "reddit", normalizedUrl),
        normalizedUrl
      ),
      cached: true
    };
  }
  try {
    const postId = await resolveRedditPostIdFromUrl(normalizedUrl, fetch, REDDIT_FETCH_USER_AGENT);
    const listingJson = await fetchRedditListingJson(postId, fetch, REDDIT_FETCH_USER_AGENT);
    const post = redditPostFromListingJson(listingJson, postId);
    if (!post) {
      return {
        notRecipe: true,
        message: "Could not read that Reddit post.",
        captionForSearch: "",
        creatorHint: null
      };
    }
    assertRedditPostImportable(post);
    if (isExternalRecipeLink(post) && post.externalUrl) {
      const external = await importFromUrl(apiKey, post.externalUrl, "web");
      if (!external) return null;
      if ("notRecipe" in external && external.notRecipe) {
        return external;
      }
      if ("recipe" in external) {
        const creditName = `u/${post.author} on r/${post.subreddit}`;
        const withRedditMeta = withImportImageUrl(
          {
            ...external.recipe,
            source_url: post.canonicalPostUrl,
            source_type: "reddit",
            social_author_name: creditName,
            social_author_url: `https://www.reddit.com/user/${encodeURIComponent(post.author)}`,
            image_url: external.recipe.image_url ?? post.imageUrl
          },
          external.recipe.image_url ?? post.imageUrl,
          post.canonicalPostUrl
        );
        await writeImportCache(cacheKey, post.canonicalPostUrl, withRedditMeta);
        return { recipe: withRedditMeta, cached: false };
      }
    }
    const comments = readCommentListing(listingJson);
    const bodyText = selectRecipeBodyText(post, comments);
    const ruleParsed = parseRuleBasedRecipeFromText(post.title, bodyText);
    let recipe = mergeRuleParsedRecipe(ruleParsed, post);
    if (!recipe || !recipeLooksValid(recipe)) {
      const geminiText = [post.title, bodyText].filter(Boolean).join("\n\n");
      const fromGemini = await extractRecipeFromPageText(
        apiKey,
        geminiText,
        post.canonicalPostUrl,
        "reddit",
        { singleModelAttempt: true }
      );
      if (!fromGemini) return null;
      recipe = withImportImageUrl(
        {
          ...fromGemini,
          social_author_name: `u/${post.author} on r/${post.subreddit}`,
          social_author_url: `https://www.reddit.com/user/${encodeURIComponent(post.author)}`
        },
        post.imageUrl,
        post.canonicalPostUrl
      );
    }
    if (!recipeLooksValid(recipe)) {
      return {
        notRecipe: true,
        message: "We could not find a recipe in that Reddit post.",
        captionForSearch: bodyText.slice(0, 400),
        creatorHint: `u/${post.author}`
      };
    }
    await writeImportCache(cacheKey, post.canonicalPostUrl, recipe);
    return { recipe, cached: false };
  } catch (error) {
    if (error instanceof RedditImportError) {
      return {
        notRecipe: true,
        message: error.userMessage,
        captionForSearch: "",
        creatorHint: null,
        suppressFallbacks: true
      };
    }
    throw error;
  }
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
    authorUrl: oembed.authorUrl ?? normalizedUrl,
    thumbnailUrl: oembed.thumbnailUrl
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
  if (sourceType === "reddit") {
    try {
      const result = await importRedditLink(apiKey, normalized);
      if (!result) {
        return jsonResponse({ error: "Could not import that Reddit post.", code: "UPSTREAM_ERROR" }, 502);
      }
      if ("notRecipe" in result && result.notRecipe) {
        if (result.suppressFallbacks) {
          return jsonResponse({ error: result.message, code: "NOT_RECIPE" }, 422);
        }
        return await respondNotRecipeWithAutoYoutube(apiKey, "reddit", false, result);
      }
      return jsonResponse({ recipe: result.recipe, cached: result.cached });
    } catch (error) {
      console.error("recipe-import reddit error", error);
      return jsonResponse({ error: "Import failed unexpectedly.", code: "UPSTREAM_ERROR" }, 502);
    }
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
