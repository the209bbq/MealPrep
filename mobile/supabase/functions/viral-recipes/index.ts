// Viral recipe shelf — YouTube search metadata cached in Supabase (no recipe text).
//
// Deploy: supabase functions deploy viral-recipes
// Secrets: YOUTUBE_API_KEY (same as recipe-import)
// Default: Verify JWT enabled — guests may call with the anon key.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const REFRESH_LOCK_MINUTES = 2;
const TARGET_PER_CATEGORY = 20;
const YOUTUBE_SEARCH_MAX = 25;

type ViralRecipesCategory = 'viral' | 'quick' | 'budget';

const CATEGORY_QUERIES: Record<ViralRecipesCategory, string> = {
  viral: 'viral recipe',
  quick: 'easy dinner recipe',
  budget: 'budget meal recipe',
};

const ALL_CATEGORIES: ViralRecipesCategory[] = ['viral', 'quick', 'budget'];

interface ViralRecipeLinkRow {
  video_id: string;
  category: ViralRecipesCategory;
  title: string;
  thumbnail_url: string;
  channel_id: string;
  channel_title: string;
  channel_url: string;
  watch_url: string;
  view_count: number;
  published_at: string | null;
  sort_rank: number;
  cached_at?: string;
}

interface ViralRecipeItemDto {
  videoId: string;
  category: ViralRecipesCategory;
  title: string;
  thumbnailUrl: string;
  channelId: string;
  channelTitle: string;
  channelUrl: string;
  watchUrl: string;
  viewCount: number;
  publishedAt: string | null;
}

interface CacheMetaRow {
  refreshed_at: string;
  refreshing_until: string | null;
  refresh_backoff_until: string | null;
}

class YoutubeApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function rowToDto(row: ViralRecipeLinkRow): ViralRecipeItemDto {
  return {
    videoId: row.video_id,
    category: row.category,
    title: row.title,
    thumbnailUrl: row.thumbnail_url,
    channelId: row.channel_id,
    channelTitle: row.channel_title,
    channelUrl: row.channel_url,
    watchUrl: row.watch_url,
    viewCount: row.view_count,
    publishedAt: row.published_at,
  };
}

function publishedAfterIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString();
}

function isHttpsUrlOnHost(raw: string, allowedHosts: readonly string[]): string | null {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.toLowerCase();
    const ok = allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
    if (!ok) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function validateVideoId(videoId: string): string | null {
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(videoId)) return null;
  return videoId;
}

function validateChannelId(channelId: string): string | null {
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(channelId)) return null;
  return channelId;
}

function buildWatchUrl(videoId: string): string | null {
  const id = validateVideoId(videoId);
  if (!id) return null;
  return isHttpsUrlOnHost(`https://www.youtube.com/watch?v=${id}`, ['youtube.com']);
}

function buildChannelUrl(channelId: string): string | null {
  const id = validateChannelId(channelId);
  if (!id) return null;
  return isHttpsUrlOnHost(`https://www.youtube.com/channel/${id}`, ['youtube.com']);
}

function validateThumbnailUrl(raw: string): string | null {
  return isHttpsUrlOnHost(raw, ['i.ytimg.com', 'yt3.ggpht.com']);
}

function sanitizeRow(row: ViralRecipeLinkRow): ViralRecipeLinkRow | null {
  const videoId = validateVideoId(row.video_id);
  const channelId = validateChannelId(row.channel_id);
  const watchUrl = buildWatchUrl(row.video_id);
  const channelUrl = channelId ? buildChannelUrl(channelId) : null;
  const thumbnailUrl = validateThumbnailUrl(row.thumbnail_url);
  const title = row.title.trim();
  const channelTitle = row.channel_title.trim();
  if (!videoId || !channelId || !watchUrl || !channelUrl || !thumbnailUrl || !title || !channelTitle) {
    return null;
  }
  return {
    ...row,
    video_id: videoId,
    channel_id: channelId,
    title,
    channel_title: channelTitle,
    thumbnail_url: thumbnailUrl,
    channel_url: channelUrl,
    watch_url: watchUrl,
  };
}

function pickThumbnail(thumbnails: Record<string, { url?: string }> | undefined): string {
  const order = ['high', 'medium', 'default'];
  for (const key of order) {
    const url = thumbnails?.[key]?.url;
    if (url) return url;
  }
  return '';
}

async function youtubeSearch(apiKey: string, query: string): Promise<string[]> {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('safeSearch', 'strict');
  url.searchParams.set('order', 'viewCount');
  url.searchParams.set('publishedAfter', publishedAfterIso());
  url.searchParams.set('maxResults', String(YOUTUBE_SEARCH_MAX));
  url.searchParams.set('q', query);
  url.searchParams.set('key', apiKey);

  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    const text = await response.text();
    throw new YoutubeApiError(`YouTube search failed: ${response.status} ${text.slice(0, 200)}`, response.status);
  }

  const body = (await response.json()) as {
    items?: Array<{
      id?: { videoId?: string };
    }>;
  };

  const videoIds: string[] = [];
  for (const item of body.items ?? []) {
    const id = item.id?.videoId;
    if (id) videoIds.push(id);
  }
  return videoIds;
}

async function youtubeVideoStats(
  apiKey: string,
  videoIds: string[],
): Promise<
  Map<
    string,
    {
      viewCount: number;
      title: string;
      channelId: string;
      channelTitle: string;
      publishedAt: string | null;
      thumbnailUrl: string;
    }
  >
> {
  const map = new Map<
    string,
    {
      viewCount: number;
      title: string;
      channelId: string;
      channelTitle: string;
      publishedAt: string | null;
      thumbnailUrl: string;
    }
  >();
  if (videoIds.length === 0) return map;

  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'snippet,statistics');
  url.searchParams.set('id', videoIds.join(','));
  url.searchParams.set('key', apiKey);

  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    const text = await response.text();
    throw new YoutubeApiError(`YouTube videos.list failed: ${response.status} ${text.slice(0, 200)}`, response.status);
  }

  const body = (await response.json()) as {
    items?: Array<{
      id?: string;
      snippet?: {
        title?: string;
        channelId?: string;
        channelTitle?: string;
        publishedAt?: string;
        thumbnails?: Record<string, { url?: string }>;
      };
      statistics?: { viewCount?: string };
    }>;
  };

  for (const item of body.items ?? []) {
    const id = item.id;
    if (!id) continue;
    const title = item.snippet?.title?.trim() ?? '';
    const channelId = item.snippet?.channelId?.trim() ?? '';
    const channelTitle = item.snippet?.channelTitle?.trim() ?? '';
    if (!title || !channelId) continue;
    map.set(id, {
      viewCount: Number(item.statistics?.viewCount ?? 0),
      title,
      channelId,
      channelTitle,
      publishedAt: item.snippet?.publishedAt ?? null,
      thumbnailUrl: pickThumbnail(item.snippet?.thumbnails),
    });
  }
  return map;
}

async function buildCategoryRows(
  apiKey: string,
  category: ViralRecipesCategory,
): Promise<ViralRecipeLinkRow[]> {
  const query = CATEGORY_QUERIES[category];
  const ids = await youtubeSearch(apiKey, query);
  const stats = await youtubeVideoStats(apiKey, ids);

  const candidates: ViralRecipeLinkRow[] = [];
  for (const videoId of ids) {
    const detail = stats.get(videoId);
    if (!detail?.thumbnailUrl) continue;
    const draft: ViralRecipeLinkRow = {
      video_id: videoId,
      category,
      title: detail.title,
      thumbnail_url: detail.thumbnailUrl,
      channel_id: detail.channelId,
      channel_title: detail.channelTitle,
      channel_url: `https://www.youtube.com/channel/${detail.channelId}`,
      watch_url: `https://www.youtube.com/watch?v=${videoId}`,
      view_count: detail.viewCount,
      published_at: detail.publishedAt,
      sort_rank: 0,
      cached_at: new Date().toISOString(),
    };
    const sanitized = sanitizeRow(draft);
    if (sanitized) candidates.push(sanitized);
  }

  candidates.sort((a, b) => b.view_count - a.view_count);
  const picked = candidates.slice(0, TARGET_PER_CATEGORY);
  picked.forEach((row, index) => {
    row.sort_rank = index;
  });
  return picked;
}

async function swapCachedRows(
  admin: ReturnType<typeof createClient>,
  allRows: ViralRecipeLinkRow[],
): Promise<void> {
  if (allRows.length > 0) {
    const { error: upsertError } = await admin
      .from('viral_recipe_links')
      .upsert(allRows, { onConflict: 'category,video_id' });
    if (upsertError) throw upsertError;
  }

  for (const category of ALL_CATEGORIES) {
    const videoIds = allRows.filter((row) => row.category === category).map((row) => row.video_id);
    if (videoIds.length === 0) continue;
    const { error: deleteError } = await admin
      .from('viral_recipe_links')
      .delete()
      .eq('category', category)
      .not('video_id', 'in', `(${videoIds.join(',')})`);
    if (deleteError) throw deleteError;
  }
}

async function refreshAllCategories(
  admin: ReturnType<typeof createClient>,
  apiKey: string,
): Promise<void> {
  const allRows: ViralRecipeLinkRow[] = [];
  for (const category of ALL_CATEGORIES) {
    const rows = await buildCategoryRows(apiKey, category);
    allRows.push(...rows);
  }

  if (allRows.length === 0) {
    throw new Error('YouTube returned no usable videos');
  }

  await swapCachedRows(admin, allRows);
  const { error: completeError } = await admin.rpc('complete_viral_recipes_refresh_success');
  if (completeError) throw completeError;
}

async function readCategory(
  admin: ReturnType<typeof createClient>,
  category: ViralRecipesCategory,
): Promise<ViralRecipeLinkRow[]> {
  const { data, error } = await admin
    .from('viral_recipe_links')
    .select(
      'video_id, category, title, thumbnail_url, channel_id, channel_title, channel_url, watch_url, view_count, published_at, sort_rank',
    )
    .eq('category', category)
    .order('sort_rank', { ascending: true })
    .limit(TARGET_PER_CATEGORY);
  if (error) throw error;
  return (data ?? []) as ViralRecipeLinkRow[];
}

async function readCacheMeta(admin: ReturnType<typeof createClient>): Promise<CacheMetaRow | null> {
  const { data, error } = await admin
    .from('viral_recipes_cache_meta')
    .select('refreshed_at, refreshing_until, refresh_backoff_until')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  return (data as CacheMetaRow | null) ?? null;
}

function cacheNeedsRefresh(meta: CacheMetaRow | null): boolean {
  if (!meta?.refreshed_at) return true;
  const now = Date.now();
  if (meta.refresh_backoff_until && new Date(meta.refresh_backoff_until).getTime() > now) {
    return false;
  }
  if (meta.refreshing_until && new Date(meta.refreshing_until).getTime() > now) {
    return false;
  }
  const age = now - new Date(meta.refreshed_at).getTime();
  return age >= CACHE_TTL_MS;
}

async function tryAcquireRefreshLock(admin: ReturnType<typeof createClient>): Promise<boolean> {
  const { data, error } = await admin.rpc('try_acquire_viral_recipes_refresh_lock', {
    p_lock_minutes: REFRESH_LOCK_MINUTES,
  });
  if (error) throw error;
  return Boolean(data);
}

async function markRefreshFailure(admin: ReturnType<typeof createClient>): Promise<void> {
  const { error } = await admin.rpc('complete_viral_recipes_refresh_failure', { p_backoff_hours: 1 });
  if (error) throw error;
}

function parseCategory(input: unknown): ViralRecipesCategory | null {
  if (input === 'viral' || input === 'quick' || input === 'budget') return input;
  return null;
}

function rateLimitKey(req: Request): string {
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length);
    const parts = token.split('.');
    if (parts.length === 3) {
      try {
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
        const payload = JSON.parse(atob(padded)) as { sub?: string };
        if (payload.sub) return payload.sub;
      } catch {
        /* ignore */
      }
    }
  }
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'anon';
}

const clientHits = new Map<string, { count: number; windowStart: number }>();
const CLIENT_WINDOW_MS = 60_000;
const CLIENT_MAX_PER_WINDOW = 40;

function checkClientRateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = clientHits.get(key);
  if (!bucket || now - bucket.windowStart > CLIENT_WINDOW_MS) {
    clientHits.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= CLIENT_MAX_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const limitKey = rateLimitKey(req);
  if (!checkClientRateLimit(limitKey)) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Try again in a minute.', code: 'RATE_LIMIT' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration incomplete.', code: 'NOT_CONFIGURED' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  let body: { category?: unknown } = {};
  try {
    body = (await req.json()) as { category?: unknown };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const category = parseCategory(body.category);
  if (!category) {
    return new Response(JSON.stringify({ error: 'Invalid category', code: 'BAD_REQUEST' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  try {
    let refreshed = false;
    const meta = await readCacheMeta(admin);
    const shouldRefresh = cacheNeedsRefresh(meta);

    if (shouldRefresh) {
      const apiKey = Deno.env.get('YOUTUBE_API_KEY') ?? '';
      if (!apiKey.trim()) {
        return new Response(
          JSON.stringify({
            error: 'Viral recipes are not set up yet. Ask an admin to finish setup.',
            code: 'NOT_CONFIGURED',
          }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const acquired = await tryAcquireRefreshLock(admin);
      if (acquired) {
        try {
          await refreshAllCategories(admin, apiKey);
          refreshed = true;
        } catch (err) {
          console.error('viral-recipes refresh failed', err);
          await markRefreshFailure(admin);
        }
      }
    }

    const rows = await readCategory(admin, category);
    const items = rows.map(rowToDto);
    return new Response(JSON.stringify({ items, cached: !refreshed, category }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('viral-recipes error', err);
    return new Response(
      JSON.stringify({ error: 'Could not load viral recipes right now.', code: 'UPSTREAM_ERROR' }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
