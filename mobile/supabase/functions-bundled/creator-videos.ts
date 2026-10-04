// AUTO-GENERATED single-file bundle for pasting into the Supabase dashboard. Source: supabase/functions/creator-videos/
// supabase/functions/creator-videos/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// supabase/functions/creator-videos/creatorVideoOverrides.ts
async function loadCreatorVideoOverrides(admin, videoIds) {
  let query = admin.from("creator_video_overrides").select("video_id, action");
  if (videoIds && videoIds.length > 0) {
    query = query.in("video_id", [...videoIds]);
  }
  const { data, error } = await query;
  if (error) throw error;
  const map = /* @__PURE__ */ new Map();
  for (const row of data ?? []) {
    const videoId = row.video_id;
    const action = row.action;
    if (action === "hide" || action === "show") {
      map.set(videoId, action);
    }
  }
  return map;
}
function applyHideOverrides(rows, overrides) {
  if (overrides.size === 0) return [...rows];
  return rows.filter((row) => overrides.get(row.video_id) !== "hide");
}
function shouldPersistVideoOnRefresh(videoId, title, description, overrides, isRecipeLike) {
  const action = overrides.get(videoId);
  if (action === "hide") return false;
  if (action === "show") return true;
  return isRecipeLike(title, description);
}

// supabase/functions/creator-videos/recipeVideoFilter.ts
var NON_RECIPE_TITLE = new RegExp(
  "\\b(vlog|mukbang|prank|q\\s*&\\s*a|qa|haul|unboxing|giveaway|merch|podcast|react|reaction|shorts compilation|behind the scenes|bts|what i eat in a day|wieiad|grocery haul|room tour|day in my life|asmr eating)\\b",
  "i"
);
var EXCLUDE_TITLE = new RegExp(
  "\\b(i tried|every country|\\$\\s*1\\s*vs|ranked|ranks|taste test|mukbang|review|blender|knives|burner|protein bars|equipment|taking a break|retirement|feedback|announcement|full episode|recap|beat bobby flay|chopped|restaurant impossible|diners, drive-ins|\\bhacks\\b|challenge|mystery|last meals|gear heads|kitchen tools|gadget|levels of|tasters|\\brate\\b|explains|what does|how to pick|answering|questions|takes on|controversial)\\b",
  "i"
);
var EXCLUDE_TESTS_TITLE = new RegExp(
  "\\b(i tested|tested|testing|let'?s test|recipe test|i had to try|trying viral|high hopes this works|is this a dumb|actually work|worth (it|making)|still good|even food|did i improve|dry[- ]?ag(?:e|ed|ing))\\b|^is\\b.*\\b(good|worth)\\b.*\\?|^can an? .+\\b(make|cook)\\b",
  "i"
);
var EXCLUDE_REVIEWS_TITLE = new RegExp(
  "\\b(rated|rating|reviews?|brutally honest|tier list|lidl|costco|trader joe'?s|h\xE4agen-dazs|haagen-dazs|hot ones|kid taste tests?|store-bought|meat experts try)\\b|\\bstore-bought\\b.{0,40}\\bbest\\b|\\bbest store-bought\\b",
  "i"
);
var EXCLUDE_STUNTS_TITLE = new RegExp(
  "\\b(exotic|would you eat|last meal|battle|bake off|showdown|who can cook|faster than)\\b|\\bi (ate|bought|cooked|paid|aged|soaked|drowned)\\b.+\\bevery\\b|\\bevery (exotic|way to cook|youtuber)\\b|\\$[\\d,]{3,}\\s*(cake|steak)\\b",
  "i"
);
var EXCLUDE_STORYTIME_TITLE = new RegExp(
  "#?storytime|(?:^|\\s)cooking stories\\b|\\bfull movie\\b|\\b\\d+ hours\\b|\\bmy hometown\\b|inside the mind|\\bhope air\\b|\\bwith (locals|bedouins)\\b",
  "i"
);
var EXCLUDE_ENTERTAINMENT_TITLE = new RegExp(
  "\\b(wwe|jackass|guitar hero|pizza avengers|gta \\d|krogerpartner|football & ice cream)\\b|breakfast in bed\\s+(?:with|ft)\\b|i shop, you cook|\\bw/@\\w+\\b|\\bcooking (?:for|with) .{0,40}(?:pogba|beerus|rush|segura)\\b|\\bi cook for a baby\\b|literally no one asked",
  "i"
);
var EXCLUDE_MISC_NON_RECIPE_TITLE = new RegExp(
  "\\bnon-negotiable\\b(?! when)|\\bbetter the .+ better the\\b|\\brecipe good\\?\\s*$|\\bbetter than jerky\\b|\\bi challenged every\\b|snow[- ]aged|\\bchooses my dinner\\b|\\bbest school lunch\\b|\\bsteak progression\\b|\\bice cream and chicken\\b|\\bi ate this .+ from\\b|\\bmeat spin\\b",
  "i"
);
var EXCLUDE_TIPS_TECHNIQUE_TITLE = new RegExp(
  "^how to(?: properly)? (soften|thicken|shape|peel|cut|reheat|store|pick|know)\\b|^how (?:much|to make your)\\b|^use this tip\\b|^i put\\b.+\\b(?:in the air fryer|air fryer)\\b|^the (?:sheet pan )?secret to\\b|^the (easiest|better|best) way to (?:peel|cut|thicken|serve|break up|shape|season)\\b|^(?:why (?:does|you should|your)|should you|what(?:'s| is| are)|stop (?:flipping|making))\\b|\\b\\d+ (?:techniques|rules|kitchen skills|essential cooking skills|ways to make cooking easier|pizza rules)\\b|(?:doing|cooking|marinating) .+ wrong|get this wrong|everything (?:you need to know|i learned)|\\b101\\b|\\bhack\\b.+\\b(?:every cook|you should know)\\b|\\bevery cook should know\\b|\\bbeen .+ wrong\\b|\\bfaster way to\\b|\\bthis tip\\b|\\btip to\\b|\\bnon-negotiable when\\b|\\btrick no one\\b|\\bscrap most people\\b|\\bmore flavorful\\b|\\btastes expensive with this\\b|\\badd flavor without\\b|\\bsoaking your cake\\b|\\bshaping dough for\\b|\\bpacks \\d+ grams of protein\\b|\\bwho eats all the food\\b|#cookingtips|\\bx fish tales\\b|\\bomelet breakage\\b|\\bshould you stir\\b|\\bis this truly the best\\b|\\bdoes not impress\\b|\\bfor the first time\\b",
  "i"
);
var MEAL_PREP_GUIDE_KEEP = /\bmeal prep guide\b/i;
var EXCLUDE_FOOD_INFO_TITLE = new RegExp(
  "\\b(difference between|types of|pink juices|smell funny|safely cooked|80/20)\\b",
  "i"
);
var EXCLUDE_GEAR_TITLE = new RegExp(
  "\\b(ice cream maker|scooper|cake pan|coffee machine|silicone bags|meat thermometer|stainless steel pan|toxic kitchen items|pizza ovens?)\\b|air fryer cooking has changed",
  "i"
);
var EXCLUDE_PROMO_TITLE = new RegExp(
  "\\b(changes are coming|signed|preview|find any recipe|cook with me every|series)\\b",
  "i"
);
function isReactionDuetTitle(title) {
  if (!/^@\w+/i.test(title.trim())) return false;
  return /#jokes?|messed it up|not what i expected/i.test(title);
}
var EXCLUDE_CHANNEL_NEWS_TITLE = new RegExp(
  "\\b(subscribers|thank you to our \\d|million subscribers)\\b",
  "i"
);
var EXCLUDE_VS = /\s+vs\.?\s+/i;
var EXCLUDE_LIVE_PREFIX = /^LIVE:/i;
var EXCLUDE_TOOLS_IN_TITLE = /\b(tools|kitchen tools)\b/i;
var GEAR_BEST_UNDER = /\bbest\b.{0,40}\bunder\s*\$/i;
var MEAL_CHALLENGE_KEEP = new RegExp(
  "\\b((\\d+\\s+)?cheap\\s+dinners?|budget\\s+meals?|grocery\\s+challenge|\\$\\d+\\s+grocery\\s+challenge).{0,50}\\b(dinners?|meals?|recipes?|week)\\b|\\b(dinners?|meals?|recipes?)\\b.{0,50}\\b(grocery\\s+challenge|\\$\\d+\\s+grocery)\\b",
  "i"
);
var TITLE_RECIPE_SIGNAL = new RegExp(
  "\\b(recipe|recipes|cook|cooking|bake|baking|dinner|dinners|lunch|breakfast|brunch|meal|meals|meal prep|air fryer|instant pot|slow cooker|soup|stew|curry|pasta|chicken|beef|steak|salmon|tacos|salad|dessert|cookies|cake|how to make|sheet pan|one[- ]pan|one[- ]pot|shakshuka|rag[u\xF9]|bolognese|tenders|orange chicken|budget|turkey|pork|vegetables|burger|pizza|rice|bread|potato|potatoes|shrimp|ramen|sandwich|chili|casserole|fish|poach|ice cream|fed my family|\\$\\d+\\s+meal|croque|lasagna|meatloaf|meat pie|omelet|omelette|aglio)\\b",
  "i"
);
var INGREDIENTS_HEADING = /\bingredients\b/i;
var MEASURED_QUANTITY = new RegExp(
  "\\b\\d+(?:\\.\\d+)?\\s*(?:cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|kg|ml|liter|litre|liters|litres)\\b",
  "i"
);
var BUDGET_KEYWORDS = new RegExp(
  "\\b(budget|cheap|affordable|frugal|dollar|under \\$|meal prep|pantry|leftovers|grocery challenge)\\b",
  "i"
);
var QUICK_TITLE = new RegExp(
  "\\b(15[- ]?minute|20[- ]?minute|30[- ]?minute|quick|easy weeknight|one pan|one[- ]pan|one[- ]pot|sheet pan|air fryer|5[- ]ingredient|five[- ]ingredient|lazy)\\b",
  "i"
);
function stripUrlsAndLinkLines(text) {
  const withoutUrls = text.replace(/https?:\/\/[^\s]+/gi, " ");
  return withoutUrls.split("\n").filter((line) => !/^\s*(?:link|links|shop|merch|subscribe|follow)\b/i.test(line.trim())).join("\n").trim();
}
function matchesGuideExclude(title) {
  if (MEAL_PREP_GUIDE_KEEP.test(title)) return false;
  return /\bguide\b/i.test(title);
}
function isShortWithoutDish(title, descriptionSnippet) {
  const titleText = title.trim();
  if (!titleText) return true;
  if (TITLE_RECIPE_SIGNAL.test(titleText)) return false;
  const descHead = stripUrlsAndLinkLines(descriptionSnippet).slice(0, 200);
  if (hasIngredientOrMeasurementSignal(descHead)) return false;
  return true;
}
function hasIngredientOrMeasurementSignal(description) {
  const text = stripUrlsAndLinkLines(description).trim();
  if (!text) return false;
  if (INGREDIENTS_HEADING.test(text)) return true;
  return MEASURED_QUANTITY.test(text);
}
function hasTitleRecipeSignal(title) {
  return TITLE_RECIPE_SIGNAL.test(title.trim());
}
function isExcludedNonRecipeContent(title, descriptionSnippet, options) {
  const titleText = title.trim();
  const description = stripUrlsAndLinkLines(descriptionSnippet).trim();
  if (!titleText && !description) return true;
  if (MEAL_CHALLENGE_KEEP.test(titleText)) return false;
  if (NON_RECIPE_TITLE.test(titleText)) return true;
  if (EXCLUDE_CHANNEL_NEWS_TITLE.test(titleText)) return true;
  if (EXCLUDE_LIVE_PREFIX.test(titleText)) return true;
  if (EXCLUDE_VS.test(titleText)) return true;
  if (EXCLUDE_TOOLS_IN_TITLE.test(titleText)) return true;
  if (EXCLUDE_TITLE.test(titleText)) return true;
  if (GEAR_BEST_UNDER.test(titleText)) return true;
  if (EXCLUDE_TESTS_TITLE.test(titleText)) return true;
  if (EXCLUDE_REVIEWS_TITLE.test(titleText)) return true;
  if (EXCLUDE_STUNTS_TITLE.test(titleText)) return true;
  if (EXCLUDE_STORYTIME_TITLE.test(titleText)) return true;
  if (EXCLUDE_ENTERTAINMENT_TITLE.test(titleText)) return true;
  if (EXCLUDE_MISC_NON_RECIPE_TITLE.test(titleText)) return true;
  if (EXCLUDE_TIPS_TECHNIQUE_TITLE.test(titleText)) return true;
  if (matchesGuideExclude(titleText)) return true;
  if (EXCLUDE_FOOD_INFO_TITLE.test(titleText)) return true;
  if (EXCLUDE_GEAR_TITLE.test(titleText)) return true;
  if (EXCLUDE_PROMO_TITLE.test(titleText)) return true;
  if (isReactionDuetTitle(titleText)) return true;
  if (options?.isShort && isShortWithoutDish(titleText, description)) return true;
  return false;
}
function isRecipeLikeVideo(title, descriptionSnippet, options) {
  const titleText = title.trim();
  const description = stripUrlsAndLinkLines(descriptionSnippet).trim();
  if (!titleText && !description) return false;
  if (isExcludedNonRecipeContent(titleText, description, options)) return false;
  if (hasTitleRecipeSignal(titleText)) return true;
  if (hasIngredientOrMeasurementSignal(description)) return true;
  return false;
}
function isLowQualityFeedVideo(title, descriptionSnippet, options) {
  return isExcludedNonRecipeContent(title, descriptionSnippet, options);
}
function matchesBudgetFeed(title, descriptionSnippet) {
  return BUDGET_KEYWORDS.test(`${title} ${stripUrlsAndLinkLines(descriptionSnippet)}`);
}
function matchesQuickFeed(title, _descriptionSnippet, _durationSeconds, _isShort) {
  return QUICK_TITLE.test(title.trim());
}
function parseIsoDurationSeconds(iso) {
  if (!iso || !iso.startsWith("PT")) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  const hours = Number.parseInt(match[1] ?? "0", 10);
  const minutes = Number.parseInt(match[2] ?? "0", 10);
  const seconds = Number.parseInt(match[3] ?? "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

// supabase/functions/creator-videos/creatorListVisibility.ts
var POSTGREST_PAGE_SIZE = 1e3;
function isVisibleInCreatorFeed(row, hideOverrides) {
  if (hideOverrides.get(row.video_id) === "hide") return false;
  return !isLowQualityFeedVideo(row.title, row.description_snippet ?? "", {
    isShort: row.is_short
  });
}
async function loadChannelIdsWithVisibleFeedVideos(admin, hideOverrides) {
  const channelIds = /* @__PURE__ */ new Set();
  let offset = 0;
  while (true) {
    const from = offset;
    const to = offset + POSTGREST_PAGE_SIZE - 1;
    const { data, error } = await admin.from("creator_videos").select("video_id, channel_id, title, description_snippet, is_short").order("video_id", { ascending: true }).range(from, to);
    if (error) throw error;
    const page = data ?? [];
    for (const row of page) {
      if (isVisibleInCreatorFeed(row, hideOverrides)) {
        channelIds.add(row.channel_id);
      }
    }
    if (page.length < POSTGREST_PAGE_SIZE) break;
    offset += POSTGREST_PAGE_SIZE;
  }
  return channelIds;
}

// supabase/functions/creator-videos/fitOrder.ts
function creatorFitSortRank(fit) {
  const normalized = (fit ?? "").toLowerCase();
  if (normalized.includes("high")) return 1;
  if (normalized.includes("medium")) return 2;
  return 3;
}
function creatorFitMixWeight(fit) {
  const rank = creatorFitSortRank(fit);
  if (rank === 1) return 3;
  if (rank === 2) return 2;
  return 1;
}
function compareCreatorsByFitAndSubscribers(a, b) {
  const fitDiff = creatorFitSortRank(a.fit) - creatorFitSortRank(b.fit);
  if (fitDiff !== 0) return fitDiff;
  return b.subscriber_count - a.subscriber_count;
}

// supabase/functions/creator-videos/feedMix.ts
var DEFAULT_TOP_WINDOW = 12;
var DEFAULT_MAX_PER_CREATOR = 2;
function channelWeight(channelId, weights) {
  return weights?.get(channelId) ?? 1;
}
function pickScore(row, weights, viewScore) {
  const fitBoost = channelWeight(row.channel_id, weights) * 1e12;
  const views = viewScore ? viewScore(row) : row.view_count;
  return fitBoost + views;
}
function mixCreatorFeed(rows, options) {
  const topWindow = options?.topWindow ?? DEFAULT_TOP_WINDOW;
  const maxPerCreator = options?.maxPerCreator ?? DEFAULT_MAX_PER_CREATOR;
  const weights = options?.channelFitWeight;
  const viewScore = options?.viewScore;
  if (rows.length <= 1) return [...rows];
  const pool = [...rows].sort(
    (a, b) => pickScore(b, weights, viewScore) - pickScore(a, weights, viewScore)
  );
  const head = [];
  const counts = /* @__PURE__ */ new Map();
  while (head.length < topWindow && pool.length > 0) {
    let pickIndex = -1;
    let pickScoreValue = -Infinity;
    for (let i = 0; i < pool.length; i += 1) {
      const candidate = pool[i];
      const channelId = candidate.channel_id;
      const count = counts.get(channelId) ?? 0;
      if (count >= maxPerCreator) continue;
      const score = pickScore(candidate, weights, viewScore);
      if (score > pickScoreValue) {
        pickScoreValue = score;
        pickIndex = i;
      }
    }
    if (pickIndex < 0) break;
    const [picked] = pool.splice(pickIndex, 1);
    counts.set(picked.channel_id, (counts.get(picked.channel_id) ?? 0) + 1);
    head.push(picked);
  }
  const tail = pool.sort(
    (a, b) => pickScore(b, weights, viewScore) - pickScore(a, weights, viewScore)
  );
  return [...head, ...tail];
}
function buildChannelFitWeightMap(creators) {
  const map = /* @__PURE__ */ new Map();
  for (const creator of creators) {
    map.set(creator.youtube_channel_id, creatorFitMixWeight(creator.fit));
  }
  return map;
}

// supabase/functions/creator-videos/videoSanitizer.ts
function stripInvalidUnicode(input) {
  let out = "";
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    if (code === 0) continue;
    if (code >= 55296 && code <= 56319) {
      const next = input.charCodeAt(i + 1);
      if (next >= 56320 && next <= 57343) {
        out += input[i] + input[i + 1];
        i += 1;
      }
      continue;
    }
    if (code >= 56320 && code <= 57343) continue;
    out += input[i];
  }
  return out;
}
function truncateByCodePoints(input, maxCodePoints) {
  const cleaned = stripInvalidUnicode(input);
  if (maxCodePoints <= 0) return "";
  const points = [...cleaned];
  if (points.length <= maxCodePoints) return cleaned;
  return points.slice(0, maxCodePoints).join("");
}
var MAX_TITLE_CODE_POINTS = 500;
var MAX_DESCRIPTION_CODE_POINTS = 500;
function sanitizeVideoUpsertRow(row) {
  const title = truncateByCodePoints(row.title.trim(), MAX_TITLE_CODE_POINTS) || "Untitled";
  const descriptionRaw = row.description_snippet?.trim() ?? "";
  const description_snippet = descriptionRaw ? truncateByCodePoints(descriptionRaw, MAX_DESCRIPTION_CODE_POINTS) : null;
  return {
    ...row,
    title,
    description_snippet: description_snippet || null,
    thumbnail_url: stripInvalidUnicode(row.thumbnail_url).trim(),
    url: stripInvalidUnicode(row.url).trim()
  };
}
function dedupeVideoUpsertRows(rows) {
  const map = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const id = row.video_id.trim();
    if (!id) continue;
    map.set(id, sanitizeVideoUpsertRow({ ...row, video_id: id }));
  }
  return [...map.values()];
}

// supabase/functions/creator-videos/youtubeRefresh.ts
var UPLOADS_PAGE_SIZE = 50;
var YOUTUBE_UNITS_CHANNELS_LIST = 1;
var YOUTUBE_UNITS_PLAYLIST_ITEMS_LIST = 1;
var YOUTUBE_UNITS_VIDEOS_LIST = 1;
var YOUTUBE_UNITS_CHANNELS_FOR_HANDLE = 1;
function normalizeHandle(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}
function channelUrlFromHandle(handle, channelId) {
  if (handle?.startsWith("@")) return `https://www.youtube.com/${handle}`;
  return `https://www.youtube.com/channel/${channelId}`;
}
async function youtubeGet(url) {
  let response;
  try {
    response = await fetch(url.toString(), { signal: AbortSignal.timeout(25e3) });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}
async function resolveChannelIdFromHandle(apiKey, handle) {
  const forHandle = normalizeHandle(handle).replace(/^@/, "");
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "id");
  url.searchParams.set("forHandle", forHandle);
  url.searchParams.set("key", apiKey);
  const data = await youtubeGet(url);
  const id = data?.items?.[0]?.id?.trim();
  return id ?? null;
}
async function fetchChannelBundle(apiKey, channelId) {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "contentDetails,statistics,snippet");
  url.searchParams.set("id", channelId);
  url.searchParams.set("key", apiKey);
  const data = await youtubeGet(url);
  const item = data?.items?.[0];
  const uploads = item?.contentDetails?.relatedPlaylists?.uploads?.trim();
  const title = item?.snippet?.title?.trim();
  if (!uploads || !title) return null;
  const customUrl = item.snippet?.customUrl?.trim() ?? null;
  const handle = customUrl ? normalizeHandle(customUrl) : null;
  const avatar = item.snippet?.thumbnails?.high?.url?.trim() ?? item.snippet?.thumbnails?.default?.url?.trim() ?? null;
  const subscriberCount = Number.parseInt(item.statistics?.subscriberCount ?? "0", 10) || 0;
  const totalViews = Number.parseInt(item.statistics?.viewCount ?? "0", 10) || 0;
  return {
    uploadsPlaylistId: uploads,
    creator: {
      youtube_channel_id: channelId,
      display_name: title,
      handle,
      channel_url: channelUrlFromHandle(handle, channelId),
      avatar_url: avatar,
      subscriber_count: subscriberCount,
      total_views: totalViews,
      enabled: true,
      rank: null,
      notes: null
    }
  };
}
async function fetchPlaylistVideoIds(apiKey, playlistId, maxItems) {
  const results = [];
  let pageToken;
  while (results.length < maxItems) {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "contentDetails,snippet");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", String(Math.min(50, maxItems - results.length)));
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const data = await youtubeGet(url);
    if (!data?.items?.length) break;
    for (const row of data.items) {
      const videoId = row.contentDetails?.videoId?.trim();
      const title = row.snippet?.title?.trim() ?? "";
      if (!videoId || !title) continue;
      const thumb = row.snippet?.thumbnails?.high?.url?.trim() ?? row.snippet?.thumbnails?.medium?.url?.trim() ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      results.push({
        videoId,
        title,
        description: row.snippet?.description?.trim() ?? "",
        publishedAt: row.snippet?.publishedAt?.trim() ?? null,
        thumbnailUrl: thumb
      });
      if (results.length >= maxItems) break;
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return results;
}
async function fetchVideoStats(apiKey, videoIds) {
  const map = /* @__PURE__ */ new Map();
  const chunks = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }
  for (const chunk of chunks) {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "statistics,contentDetails,snippet");
    url.searchParams.set("id", chunk.join(","));
    url.searchParams.set("key", apiKey);
    const data = await youtubeGet(url);
    for (const item of data?.items ?? []) {
      const id = item.id?.trim();
      if (id) map.set(id, item);
    }
  }
  return map;
}
async function refreshCreatorVideos(apiKey, channelId, uploadsPlaylistId, overrides = /* @__PURE__ */ new Map()) {
  const playlistItems = await fetchPlaylistVideoIds(apiKey, uploadsPlaylistId, UPLOADS_PAGE_SIZE);
  const ids = playlistItems.map((row) => row.videoId);
  const stats = await fetchVideoStats(apiKey, ids);
  const fetchedAt = (/* @__PURE__ */ new Date()).toISOString();
  const videos = [];
  for (const item of playlistItems) {
    const detail = stats.get(item.videoId);
    const snippetDesc = detail?.snippet?.description?.trim() ?? item.description;
    const title = detail?.snippet?.title?.trim() ?? item.title;
    const durationSeconds = parseIsoDurationSeconds(detail?.contentDetails?.duration);
    const isShort = durationSeconds != null && durationSeconds > 0 && durationSeconds <= 60;
    if (!shouldPersistVideoOnRefresh(
      item.videoId,
      title,
      snippetDesc,
      overrides,
      (videoTitle, description) => isRecipeLikeVideo(videoTitle, description, { isShort })
    )) {
      continue;
    }
    const viewCount = Number.parseInt(detail?.statistics?.viewCount ?? "0", 10) || 0;
    const likeCount = Number.parseInt(detail?.statistics?.likeCount ?? "0", 10) || 0;
    videos.push({
      video_id: item.videoId,
      channel_id: channelId,
      title,
      description_snippet: snippetDesc || null,
      thumbnail_url: item.thumbnailUrl,
      published_at: item.publishedAt,
      view_count: viewCount,
      like_count: likeCount,
      duration_seconds: durationSeconds,
      is_short: isShort,
      url: `https://www.youtube.com/watch?v=${item.videoId}`,
      fetched_at: fetchedAt
    });
  }
  const avgViews = videos.length > 0 ? Math.round(videos.reduce((sum, row) => sum + row.view_count, 0) / videos.length) : 0;
  const avgLikes = videos.length > 0 ? Math.round(videos.reduce((sum, row) => sum + row.like_count, 0) / videos.length) : 0;
  return { videos: dedupeVideoUpsertRows(videos), avgViews, avgLikes };
}
function estimateRefreshUnitsForCreator(playlistPages, videoListChunks) {
  return YOUTUBE_UNITS_CHANNELS_LIST + playlistPages * YOUTUBE_UNITS_PLAYLIST_ITEMS_LIST + videoListChunks * YOUTUBE_UNITS_VIDEOS_LIST;
}
function estimateVideoListChunks(videoCount) {
  return Math.max(1, Math.ceil(videoCount / 50));
}
async function upsertCreatorByHandle(apiKey, handle) {
  const channelId = await resolveChannelIdFromHandle(apiKey, handle);
  if (!channelId) return null;
  const bundle = await fetchChannelBundle(apiKey, channelId);
  if (!bundle) return null;
  return { channelId, creator: bundle.creator };
}

// supabase/functions/creator-videos/refreshPersist.ts
async function pruneCreatorVideos(admin, channelId, keptVideoIds) {
  if (keptVideoIds.length === 0) {
    const { error: error2 } = await admin.from("creator_videos").delete().eq("channel_id", channelId);
    if (error2) throw error2;
    return;
  }
  const inList = `(${keptVideoIds.map((id) => `"${id.replaceAll('"', "")}"`).join(",")})`;
  const { error } = await admin.from("creator_videos").delete().eq("channel_id", channelId).not("video_id", "in", inList);
  if (error) throw error;
}
async function refreshAndPersistCreator(admin, apiKey, channelId, options) {
  const displayNameFallback = channelId;
  let youtubeUnits = 1;
  try {
    const bundle = await fetchChannelBundle(apiKey, channelId);
    if (!bundle) {
      return {
        channelId,
        displayName: displayNameFallback,
        ok: false,
        error: "Could not load channel from YouTube",
        videosUpserted: 0,
        youtubeUnits: 1
      };
    }
    const { videos, avgViews, avgLikes } = await refreshCreatorVideos(
      apiKey,
      channelId,
      bundle.uploadsPlaylistId,
      options?.videoOverrides ?? /* @__PURE__ */ new Map()
    );
    youtubeUnits = estimateRefreshUnitsForCreator(
      1,
      estimateVideoListChunks(Math.max(videos.length, 1))
    );
    const displayName = bundle.creator.display_name;
    if (options?.creatorPatchOnInsert) {
      const { error: insertError } = await admin.from("recipe_creators").upsert(
        {
          ...options.creatorPatchOnInsert,
          youtube_channel_id: channelId,
          avg_views: avgViews,
          avg_likes: avgLikes,
          enabled: true
        },
        { onConflict: "youtube_channel_id" }
      );
      if (insertError) throw insertError;
    } else {
      const { error: updateError } = await admin.from("recipe_creators").update({
        display_name: bundle.creator.display_name,
        handle: bundle.creator.handle,
        channel_url: bundle.creator.channel_url,
        avatar_url: bundle.creator.avatar_url,
        subscriber_count: bundle.creator.subscriber_count,
        total_views: bundle.creator.total_views,
        avg_views: avgViews,
        avg_likes: avgLikes,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("youtube_channel_id", channelId);
      if (updateError) throw updateError;
    }
    const keptIds = videos.map((row) => row.video_id);
    if (videos.length > 0) {
      const { error: upsertVideosError } = await admin.from("creator_videos").upsert(videos, { onConflict: "video_id" });
      if (upsertVideosError) throw upsertVideosError;
    }
    await pruneCreatorVideos(admin, channelId, keptIds);
    return {
      channelId,
      displayName,
      ok: true,
      videosUpserted: videos.length,
      youtubeUnits
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("creator-videos refresh failed for channel", channelId, err);
    return {
      channelId,
      displayName: displayNameFallback,
      ok: false,
      error: message,
      videosUpserted: 0,
      youtubeUnits
    };
  }
}

// supabase/functions/creator-videos/index.ts
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-creator-admin-secret"
};
var ADMIN_SECRET_HEADER = "x-creator-admin-secret";
function creatorToDto(row) {
  return {
    id: row.id,
    youtubeChannelId: row.youtube_channel_id,
    displayName: row.display_name,
    handle: row.handle,
    channelUrl: row.channel_url,
    avatarUrl: row.avatar_url,
    subscriberCount: row.subscriber_count,
    rank: row.rank,
    fit: row.fit ?? "Medium",
    source: row.source
  };
}
function videoToDto(row, creator) {
  return {
    videoId: row.video_id,
    channelId: row.channel_id,
    creatorName: creator?.display_name ?? "Creator",
    creatorHandle: creator?.handle ?? null,
    creatorAvatarUrl: creator?.avatar_url ?? null,
    channelUrl: creator?.channel_url ?? `https://www.youtube.com/channel/${row.channel_id}`,
    title: row.title,
    descriptionSnippet: row.description_snippet,
    thumbnailUrl: row.thumbnail_url,
    publishedAt: row.published_at,
    viewCount: row.view_count,
    likeCount: row.like_count,
    durationSeconds: row.duration_seconds,
    isShort: row.is_short,
    watchUrl: row.url
  };
}
function authorizeRefresh(req) {
  const expected = (Deno.env.get("CREATOR_ADMIN_SECRET") ?? "").trim();
  const provided = (req.headers.get(ADMIN_SECRET_HEADER) ?? "").trim();
  return Boolean(expected && provided && provided === expected);
}
function rateLimitKey(req) {
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length);
    const parts = token.split(".");
    if (parts.length === 3) {
      try {
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
        const payload = JSON.parse(atob(padded));
        if (payload.sub) return payload.sub;
      } catch {
      }
    }
  }
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "anon";
}
var clientHits = /* @__PURE__ */ new Map();
var CLIENT_WINDOW_MS = 6e4;
var CLIENT_MAX_PER_WINDOW = 60;
var SEARCH_MAX_PER_WINDOW = 20;
function checkClientRateLimit(key, max) {
  const now = Date.now();
  const bucket = clientHits.get(key);
  if (!bucket || now - bucket.windowStart > CLIENT_WINDOW_MS) {
    clientHits.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}
function parseFeedMode(input) {
  if (input === "new" || input === "quick" || input === "budget" || input === "popular") {
    return input;
  }
  return "popular";
}
async function loadCreatorsMap(admin) {
  const { data, error } = await admin.from("recipe_creators").select(
    "id, youtube_channel_id, display_name, handle, channel_url, avatar_url, subscriber_count, avg_views, rank, fit, source"
  ).eq("enabled", true);
  if (error) throw error;
  const sorted = [...data ?? []].sort(compareCreatorsByFitAndSubscribers);
  const map = /* @__PURE__ */ new Map();
  for (const row of sorted) {
    map.set(row.youtube_channel_id, row);
  }
  return map;
}
async function readFeedVideos(admin, mode, channelFitWeight, creatorsMap, hideOverrides) {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1e3).toISOString();
  let query = admin.from("creator_videos").select(
    "video_id, channel_id, title, description_snippet, thumbnail_url, published_at, view_count, like_count, duration_seconds, is_short, url"
  ).limit(400);
  if (mode === "popular") {
    query = query.gte("published_at", ninetyDaysAgo);
  } else if (mode === "new") {
    query = query.order("published_at", { ascending: false, nullsFirst: false });
  } else {
    query = query.order("published_at", { ascending: false, nullsFirst: false });
  }
  const { data, error } = await query;
  if (error) throw error;
  let rows = applyHideOverrides(data ?? [], hideOverrides);
  if (mode === "popular") {
    rows = rows.filter(
      (row) => !isLowQualityFeedVideo(row.title, row.description_snippet ?? "", {
        isShort: row.is_short
      })
    );
    const relativeViewScore = (row) => {
      const channelAvg = creatorsMap.get(row.channel_id)?.avg_views ?? 0;
      const baseline = channelAvg > 0 ? channelAvg : Math.max(row.view_count, 1);
      return row.view_count / baseline;
    };
    rows = mixCreatorFeed(rows, {
      channelFitWeight,
      viewScore: (row) => Math.round(relativeViewScore(row) * 1e6)
    });
    return rows.slice(0, 60);
  }
  if (mode === "quick") {
    rows = rows.filter(
      (row) => matchesQuickFeed(
        row.title,
        row.description_snippet ?? "",
        row.duration_seconds,
        row.is_short
      )
    );
    rows.sort((a, b) => (a.duration_seconds ?? 9999) - (b.duration_seconds ?? 9999));
  } else if (mode === "budget") {
    rows = rows.filter(
      (row) => matchesBudgetFeed(row.title, row.description_snippet ?? "")
    );
    rows.sort((a, b) => b.view_count - a.view_count);
  }
  return mixCreatorFeed(rows, { channelFitWeight }).slice(0, 60);
}
async function handlePublicAction(admin, body, limitKey) {
  const creatorsMap = await loadCreatorsMap(admin);
  const hideOverrides = await loadCreatorVideoOverrides(admin);
  if (body.action === "creators") {
    const channelsWithVideos = await loadChannelIdsWithVisibleFeedVideos(admin, hideOverrides);
    const creators = [...creatorsMap.values()].filter((row) => channelsWithVideos.has(row.youtube_channel_id)).sort(compareCreatorsByFitAndSubscribers).map(creatorToDto);
    return jsonResponse({ creators });
  }
  if (body.action === "creator") {
    const handle = typeof body.handle === "string" ? body.handle.trim() : "";
    const channelId = typeof body.channelId === "string" && body.channelId.trim() ? body.channelId.trim() : "";
    let creator;
    if (channelId) creator = creatorsMap.get(channelId);
    if (!creator && handle) {
      const normalized = handle.toLowerCase();
      creator = [...creatorsMap.values()].find(
        (row) => row.handle?.toLowerCase() === normalized || row.handle?.toLowerCase() === `@${normalized.replace(/^@/, "")}`
      );
    }
    if (!creator) {
      return jsonResponse({ creator: null, videos: [] });
    }
    const { data, error } = await admin.from("creator_videos").select(
      "video_id, channel_id, title, description_snippet, thumbnail_url, published_at, view_count, like_count, duration_seconds, is_short, url"
    ).eq("channel_id", creator.youtube_channel_id).order("published_at", { ascending: false, nullsFirst: false }).limit(80);
    if (error) throw error;
    const videos = applyHideOverrides(data ?? [], hideOverrides).map(
      (row) => videoToDto(row, creator)
    );
    return jsonResponse({ creator: creatorToDto(creator), videos });
  }
  if (body.action === "feed") {
    const mode = parseFeedMode(body.mode);
    const fitWeights = buildChannelFitWeightMap(creatorsMap.values());
    const rows = await readFeedVideos(admin, mode, fitWeights, creatorsMap, hideOverrides);
    const videos = rows.map((row) => videoToDto(row, creatorsMap.get(row.channel_id)));
    return jsonResponse({ mode, videos });
  }
  if (body.action === "search") {
    const q = typeof body.q === "string" ? body.q.trim() : "";
    if (q.length < 2) {
      return jsonResponse({ videos: [] });
    }
    if (!checkClientRateLimit(`${limitKey}:search`, SEARCH_MAX_PER_WINDOW)) {
      return jsonResponse(
        { error: "Too many searches. Try again in a minute.", code: "RATE_LIMIT" },
        429
      );
    }
    const { data, error } = await admin.rpc("search_creator_videos", { p_query: q, p_limit: 40 });
    if (error) throw error;
    const rows = applyHideOverrides(data ?? [], hideOverrides);
    const videos = rows.map((row) => videoToDto(row, creatorsMap.get(row.channel_id)));
    return jsonResponse({ videos, q });
  }
  return jsonResponse({ error: "Unknown action", code: "BAD_REQUEST" }, 400);
}
async function refreshAllEnabledCreators(admin, apiKey) {
  const { data: creators, error } = await admin.from("recipe_creators").select("youtube_channel_id, display_name, enabled").eq("enabled", true);
  if (error) throw error;
  const results = [];
  let videoCount = 0;
  let youtubeUnitsEstimate = 0;
  const videoOverrides = await loadCreatorVideoOverrides(admin);
  for (const row of creators ?? []) {
    const channelId = row.youtube_channel_id;
    const seedName = row.display_name ?? channelId;
    const outcome = await refreshAndPersistCreator(admin, apiKey, channelId, {
      videoOverrides
    });
    youtubeUnitsEstimate += outcome.youtubeUnits;
    videoCount += outcome.videosUpserted;
    results.push({
      channelId: outcome.channelId,
      displayName: outcome.displayName || seedName,
      ok: outcome.ok,
      error: outcome.error,
      videosUpserted: outcome.videosUpserted
    });
  }
  return {
    refreshedCreators: creators?.length ?? 0,
    refreshedVideos: videoCount,
    youtubeUnitsEstimate,
    creators: results
  };
}
async function refreshSingleCreator(admin, apiKey, options) {
  let channelId = options.channelId?.trim() ?? "";
  let creatorPatch = null;
  let youtubeUnitsEstimate = 0;
  const isNewByHandle = Boolean(!channelId && options.handle?.trim());
  if (isNewByHandle) {
    const resolved = await upsertCreatorByHandle(apiKey, options.handle);
    youtubeUnitsEstimate += YOUTUBE_UNITS_CHANNELS_FOR_HANDLE;
    if (!resolved) return null;
    channelId = resolved.channelId;
    creatorPatch = {
      ...resolved.creator,
      fit: "Medium",
      source: "david_pick",
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  if (!channelId) return null;
  const videoOverrides = await loadCreatorVideoOverrides(admin);
  const outcome = await refreshAndPersistCreator(admin, apiKey, channelId, {
    creatorPatchOnInsert: isNewByHandle ? creatorPatch ?? void 0 : void 0,
    videoOverrides
  });
  youtubeUnitsEstimate += outcome.youtubeUnits;
  return {
    channelId: outcome.channelId,
    displayName: outcome.displayName,
    ok: outcome.ok,
    error: outcome.error,
    videosUpserted: outcome.videosUpserted,
    youtubeUnitsEstimate
  };
}
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "Server configuration incomplete.", code: "NOT_CONFIGURED" }, 503);
  }
  const admin = createClient(supabaseUrl, serviceKey);
  const limitKey = rateLimitKey(req);
  if (!checkClientRateLimit(limitKey, CLIENT_MAX_PER_WINDOW)) {
    return jsonResponse(
      { error: "Too many requests. Try again in a minute.", code: "RATE_LIMIT" },
      429
    );
  }
  let body = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  const action = body.action;
  if (action === "refresh") {
    if (!authorizeRefresh(req)) {
      return jsonResponse({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    }
    const apiKey = Deno.env.get("YOUTUBE_API_KEY") ?? "";
    if (!apiKey.trim()) {
      return jsonResponse({ error: "YOUTUBE_API_KEY not configured", code: "NOT_CONFIGURED" }, 503);
    }
    const refreshBody = body;
    const handle = typeof refreshBody.handle === "string" ? refreshBody.handle : void 0;
    const channelId = typeof refreshBody.channelId === "string" ? refreshBody.channelId : typeof refreshBody.youtubeChannelId === "string" ? refreshBody.youtubeChannelId : void 0;
    try {
      if (handle?.trim() || channelId?.trim()) {
        const result = await refreshSingleCreator(admin, apiKey, { handle, channelId });
        if (!result) {
          return jsonResponse({ error: "Could not resolve creator", code: "NOT_FOUND" }, 404);
        }
        if (!result.ok) {
          return jsonResponse(
            { ok: false, ...result, code: "UPSTREAM_ERROR" },
            502
          );
        }
        return jsonResponse({ ok: true, ...result });
      }
      const summary = await refreshAllEnabledCreators(admin, apiKey);
      const failed = summary.creators.filter((row) => !row.ok).length;
      return jsonResponse({
        ok: failed === 0,
        ...summary,
        failedCreators: failed
      });
    } catch (err) {
      console.error("creator-videos refresh failed", err);
      return jsonResponse({ error: "Refresh failed", code: "UPSTREAM_ERROR" }, 502);
    }
  }
  try {
    return await handlePublicAction(admin, body, limitKey);
  } catch (err) {
    console.error("creator-videos error", err);
    return jsonResponse({ error: "Could not load creator recipes right now.", code: "UPSTREAM_ERROR" }, 502);
  }
});
