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
    throw new Error(`YouTube search failed: ${response.status} ${text.slice(0, 200)}`);
  }

  const body = (await response.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelId?: string;
        channelTitle?: string;
        publishedAt?: string;
        thumbnails?: Record<string, { url?: string }>;
      };
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
    throw new Error(`YouTube videos.list failed: ${response.status} ${text.slice(0, 200)}`);
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
  seenVideoIds: Set<string>,
): Promise<ViralRecipeLinkRow[]> {
  const query = CATEGORY_QUERIES[category];
  const ids = await youtubeSearch(apiKey, query);
  const stats = await youtubeVideoStats(apiKey, ids);

  const candidates: ViralRecipeLinkRow[] = [];
  for (const videoId of ids) {
    if (seenVideoIds.has(videoId)) continue;
    const detail = stats.get(videoId);
    if (!detail?.thumbnailUrl) continue;
    candidates.push({
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
    });
  }

  candidates.sort((a, b) => b.view_count - a.view_count);
  const picked = candidates.slice(0, TARGET_PER_CATEGORY);
  picked.forEach((row, index) => {
    row.sort_rank = index;
    seenVideoIds.add(row.video_id);
  });
  return picked;
}

async function refreshAllCategories(
  admin: ReturnType<typeof createClient>,
  apiKey: string,
): Promise<void> {
  const seen = new Set<string>();
  const allRows: ViralRecipeLinkRow[] = [];
  for (const category of ALL_CATEGORIES) {
    const rows = await buildCategoryRows(apiKey, category, seen);
    allRows.push(...rows);
  }

  const { error: deleteError } = await admin.from('viral_recipe_links').delete().neq('video_id', '');
  if (deleteError) throw deleteError;

  if (allRows.length > 0) {
    const { error: insertError } = await admin.from('viral_recipe_links').insert(allRows);
    if (insertError) throw insertError;
  }

  const { error: metaError } = await admin
    .from('viral_recipes_cache_meta')
    .upsert({ id: 1, refreshed_at: new Date().toISOString() });
  if (metaError) throw metaError;
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

async function cacheIsFresh(admin: ReturnType<typeof createClient>): Promise<boolean> {
  const { data, error } = await admin
    .from('viral_recipes_cache_meta')
    .select('refreshed_at')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  const refreshedAt = data?.refreshed_at;
  if (!refreshedAt) return false;
  const age = Date.now() - new Date(refreshedAt).getTime();
  return age < CACHE_TTL_MS;
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
    const fresh = await cacheIsFresh(admin);
    if (!fresh) {
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
      await refreshAllCategories(admin, apiKey);
      refreshed = true;
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
