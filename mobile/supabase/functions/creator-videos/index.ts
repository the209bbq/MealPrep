// Creator recipe videos — cached YouTube metadata for trusted channels (no search.list).
//
// Deploy: supabase functions deploy creator-videos
// Secrets: YOUTUBE_API_KEY, CREATOR_ADMIN_SECRET (refresh + upsert by handle)
// Default: Verify JWT enabled — guests may call public read actions with the anon key.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { buildChannelFitWeightMap, mixCreatorFeed } from './feedMix.ts';
import { compareCreatorsByFitAndSubscribers } from './fitOrder.ts';
import {
  matchesBudgetFeed,
  matchesQuickFeed,
} from './recipeVideoFilter.ts';
import {
  fetchChannelBundle,
  refreshCreatorVideos,
  upsertCreatorByHandle,
} from './youtubeRefresh.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-creator-admin-secret',
};

const ADMIN_SECRET_HEADER = 'x-creator-admin-secret';

type FeedMode = 'popular' | 'new' | 'quick' | 'budget';

type PublicAction =
  | { action: 'creators' }
  | { action: 'creator'; channelId?: string; handle?: string }
  | { action: 'feed'; mode?: FeedMode }
  | { action: 'search'; q?: string };

type RefreshBody = {
  action: 'refresh';
  handle?: string;
  channelId?: string;
  youtubeChannelId?: string;
};

interface CreatorDto {
  id: string;
  youtubeChannelId: string;
  displayName: string;
  handle: string | null;
  channelUrl: string;
  avatarUrl: string | null;
  subscriberCount: number;
  rank: number | null;
  fit: string;
  source: string | null;
}

interface VideoDto {
  videoId: string;
  channelId: string;
  creatorName: string;
  creatorHandle: string | null;
  creatorAvatarUrl: string | null;
  channelUrl: string;
  title: string;
  descriptionSnippet: string | null;
  thumbnailUrl: string;
  publishedAt: string | null;
  viewCount: number;
  likeCount: number;
  durationSeconds: number | null;
  isShort: boolean;
  watchUrl: string;
}

interface CreatorRow {
  id: string;
  youtube_channel_id: string;
  display_name: string;
  handle: string | null;
  channel_url: string;
  avatar_url: string | null;
  subscriber_count: number;
  rank: number | null;
  fit: string | null;
  source: string | null;
}

interface VideoRow {
  video_id: string;
  channel_id: string;
  title: string;
  description_snippet: string | null;
  thumbnail_url: string;
  published_at: string | null;
  view_count: number;
  like_count: number;
  duration_seconds: number | null;
  is_short: boolean;
  url: string;
}

function creatorToDto(row: CreatorRow): CreatorDto {
  return {
    id: row.id,
    youtubeChannelId: row.youtube_channel_id,
    displayName: row.display_name,
    handle: row.handle,
    channelUrl: row.channel_url,
    avatarUrl: row.avatar_url,
    subscriberCount: row.subscriber_count,
    rank: row.rank,
    fit: row.fit ?? 'Medium',
    source: row.source,
  };
}

function videoToDto(row: VideoRow, creator: CreatorRow | undefined): VideoDto {
  return {
    videoId: row.video_id,
    channelId: row.channel_id,
    creatorName: creator?.display_name ?? 'Creator',
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
    watchUrl: row.url,
  };
}

function authorizeRefresh(req: Request): boolean {
  const expected = (Deno.env.get('CREATOR_ADMIN_SECRET') ?? '').trim();
  const provided = (req.headers.get(ADMIN_SECRET_HEADER) ?? '').trim();
  return Boolean(expected && provided && provided === expected);
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
const CLIENT_MAX_PER_WINDOW = 60;
const SEARCH_MAX_PER_WINDOW = 20;

function checkClientRateLimit(key: string, max: number): boolean {
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

function parseFeedMode(input: unknown): FeedMode {
  if (input === 'new' || input === 'quick' || input === 'budget' || input === 'popular') {
    return input;
  }
  return 'popular';
}

async function loadCreatorsMap(
  admin: ReturnType<typeof createClient>,
): Promise<Map<string, CreatorRow>> {
  const { data, error } = await admin
    .from('recipe_creators')
    .select(
      'id, youtube_channel_id, display_name, handle, channel_url, avatar_url, subscriber_count, rank, fit, source',
    )
    .eq('enabled', true);
  if (error) throw error;
  const sorted = [...((data ?? []) as CreatorRow[])].sort(compareCreatorsByFitAndSubscribers);
  const map = new Map<string, CreatorRow>();
  for (const row of sorted) {
    map.set(row.youtube_channel_id, row);
  }
  return map;
}

async function readFeedVideos(
  admin: ReturnType<typeof createClient>,
  mode: FeedMode,
  channelFitWeight: Map<string, number>,
): Promise<VideoRow[]> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  let query = admin
    .from('creator_videos')
    .select(
      'video_id, channel_id, title, description_snippet, thumbnail_url, published_at, view_count, like_count, duration_seconds, is_short, url',
    )
    .limit(400);

  if (mode === 'popular') {
    query = query.gte('published_at', ninetyDaysAgo).order('view_count', { ascending: false });
  } else if (mode === 'new') {
    query = query.order('published_at', { ascending: false, nullsFirst: false });
  } else {
    query = query.order('published_at', { ascending: false, nullsFirst: false });
  }

  const { data, error } = await query;
  if (error) throw error;
  let rows = (data ?? []) as VideoRow[];

  if (mode === 'quick') {
    rows = rows.filter((row) =>
      matchesQuickFeed(
        row.title,
        row.description_snippet ?? '',
        row.duration_seconds,
        row.is_short,
      ),
    );
    rows.sort((a, b) => (a.duration_seconds ?? 9999) - (b.duration_seconds ?? 9999));
  } else if (mode === 'budget') {
    rows = rows.filter((row) =>
      matchesBudgetFeed(row.title, row.description_snippet ?? ''),
    );
    rows.sort((a, b) => b.view_count - a.view_count);
  }

  return mixCreatorFeed(rows, { channelFitWeight }).slice(0, 60);
}

async function handlePublicAction(
  admin: ReturnType<typeof createClient>,
  body: PublicAction,
  limitKey: string,
): Promise<Response> {
  const creatorsMap = await loadCreatorsMap(admin);

  if (body.action === 'creators') {
    const creators = [...creatorsMap.values()]
      .sort(compareCreatorsByFitAndSubscribers)
      .map(creatorToDto);
    return jsonResponse({ creators });
  }

  if (body.action === 'creator') {
    const handle = typeof body.handle === 'string' ? body.handle.trim() : '';
    const channelId =
      typeof body.channelId === 'string' && body.channelId.trim()
        ? body.channelId.trim()
        : '';
    let creator: CreatorRow | undefined;
    if (channelId) creator = creatorsMap.get(channelId);
    if (!creator && handle) {
      const normalized = handle.toLowerCase();
      creator = [...creatorsMap.values()].find(
        (row) => row.handle?.toLowerCase() === normalized || row.handle?.toLowerCase() === `@${normalized.replace(/^@/, '')}`,
      );
    }
    if (!creator) {
      return jsonResponse({ creator: null, videos: [] });
    }
    const { data, error } = await admin
      .from('creator_videos')
      .select(
        'video_id, channel_id, title, description_snippet, thumbnail_url, published_at, view_count, like_count, duration_seconds, is_short, url',
      )
      .eq('channel_id', creator.youtube_channel_id)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(80);
    if (error) throw error;
    const videos = ((data ?? []) as VideoRow[]).map((row) => videoToDto(row, creator));
    return jsonResponse({ creator: creatorToDto(creator), videos });
  }

  if (body.action === 'feed') {
    const mode = parseFeedMode(body.mode);
    const fitWeights = buildChannelFitWeightMap(creatorsMap.values());
    const rows = await readFeedVideos(admin, mode, fitWeights);
    const videos = rows.map((row) => videoToDto(row, creatorsMap.get(row.channel_id)));
    return jsonResponse({ mode, videos });
  }

  if (body.action === 'search') {
    const q = typeof body.q === 'string' ? body.q.trim() : '';
    if (q.length < 2) {
      return jsonResponse({ videos: [] });
    }
    if (!checkClientRateLimit(`${limitKey}:search`, SEARCH_MAX_PER_WINDOW)) {
      return jsonResponse(
        { error: 'Too many searches. Try again in a minute.', code: 'RATE_LIMIT' },
        429,
      );
    }
    const { data, error } = await admin.rpc('search_creator_videos', { p_query: q, p_limit: 40 });
    if (error) throw error;
    const rows = (data ?? []) as VideoRow[];
    const videos = rows.map((row) => videoToDto(row, creatorsMap.get(row.channel_id)));
    return jsonResponse({ videos, q });
  }

  return jsonResponse({ error: 'Unknown action', code: 'BAD_REQUEST' }, 400);
}

async function refreshAllEnabledCreators(
  admin: ReturnType<typeof createClient>,
  apiKey: string,
): Promise<{ refreshedCreators: number; refreshedVideos: number }> {
  const { data: creators, error } = await admin
    .from('recipe_creators')
    .select('youtube_channel_id, enabled')
    .eq('enabled', true);
  if (error) throw error;

  let videoCount = 0;
  for (const row of creators ?? []) {
    const channelId = (row as { youtube_channel_id: string }).youtube_channel_id;
    const bundle = await fetchChannelBundle(apiKey, channelId);
    if (!bundle) continue;

    const { videos, avgViews, avgLikes } = await refreshCreatorVideos(
      apiKey,
      channelId,
      bundle.uploadsPlaylistId,
    );

    const { error: updateCreatorError } = await admin
      .from('recipe_creators')
      .update({
        display_name: bundle.creator.display_name,
        handle: bundle.creator.handle,
        channel_url: bundle.creator.channel_url,
        avatar_url: bundle.creator.avatar_url,
        subscriber_count: bundle.creator.subscriber_count,
        total_views: bundle.creator.total_views,
        avg_views: avgViews,
        avg_likes: avgLikes,
        updated_at: new Date().toISOString(),
      })
      .eq('youtube_channel_id', channelId);
    if (updateCreatorError) throw updateCreatorError;

    if (videos.length > 0) {
      const { error: upsertVideosError } = await admin
        .from('creator_videos')
        .upsert(videos, { onConflict: 'video_id' });
      if (upsertVideosError) throw upsertVideosError;
      videoCount += videos.length;
    }
  }

  return { refreshedCreators: creators?.length ?? 0, refreshedVideos: videoCount };
}

async function refreshSingleCreator(
  admin: ReturnType<typeof createClient>,
  apiKey: string,
  options: { handle?: string; channelId?: string },
): Promise<{ channelId: string; videos: number } | null> {
  let channelId = options.channelId?.trim() ?? '';
  let creatorPatch: Record<string, unknown> | null = null;

  const isNewByHandle = Boolean(!channelId && options.handle?.trim());

  if (isNewByHandle) {
    const resolved = await upsertCreatorByHandle(apiKey, options.handle!);
    if (!resolved) return null;
    channelId = resolved.channelId;
    creatorPatch = {
      ...resolved.creator,
      fit: 'Medium',
      source: 'david_pick',
      updated_at: new Date().toISOString(),
    };
  }

  if (!channelId) return null;

  const bundle = await fetchChannelBundle(apiKey, channelId);
  if (!bundle) return null;

  const { videos, avgViews, avgLikes } = await refreshCreatorVideos(
    apiKey,
    channelId,
    bundle.uploadsPlaylistId,
  );

  if (isNewByHandle && creatorPatch) {
    const { error: insertError } = await admin.from('recipe_creators').upsert(
      {
        ...creatorPatch,
        youtube_channel_id: channelId,
        avg_views: avgViews,
        avg_likes: avgLikes,
        enabled: true,
      },
      { onConflict: 'youtube_channel_id' },
    );
    if (insertError) throw insertError;
  } else {
    const { error: updateError } = await admin
      .from('recipe_creators')
      .update({
        display_name: bundle.creator.display_name,
        handle: bundle.creator.handle,
        channel_url: bundle.creator.channel_url,
        avatar_url: bundle.creator.avatar_url,
        subscriber_count: bundle.creator.subscriber_count,
        total_views: bundle.creator.total_views,
        avg_views: avgViews,
        avg_likes: avgLikes,
        updated_at: new Date().toISOString(),
      })
      .eq('youtube_channel_id', channelId);
    if (updateError) throw updateError;
  }

  if (videos.length > 0) {
    const { error: upsertVideosError } = await admin
      .from('creator_videos')
      .upsert(videos, { onConflict: 'video_id' });
    if (upsertVideosError) throw upsertVideosError;
  }

  return { channelId, videos: videos.length };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: 'Server configuration incomplete.', code: 'NOT_CONFIGURED' }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const limitKey = rateLimitKey(req);
  if (!checkClientRateLimit(limitKey, CLIENT_MAX_PER_WINDOW)) {
    return jsonResponse(
      { error: 'Too many requests. Try again in a minute.', code: 'RATE_LIMIT' },
      429,
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const action = body.action;

  if (action === 'refresh') {
    if (!authorizeRefresh(req)) {
      return jsonResponse({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }
    const apiKey = Deno.env.get('YOUTUBE_API_KEY') ?? '';
    if (!apiKey.trim()) {
      return jsonResponse({ error: 'YOUTUBE_API_KEY not configured', code: 'NOT_CONFIGURED' }, 503);
    }

    const refreshBody = body as RefreshBody;
    const handle = typeof refreshBody.handle === 'string' ? refreshBody.handle : undefined;
    const channelId =
      typeof refreshBody.channelId === 'string'
        ? refreshBody.channelId
        : typeof refreshBody.youtubeChannelId === 'string'
          ? refreshBody.youtubeChannelId
          : undefined;

    try {
      if (handle?.trim() || channelId?.trim()) {
        const result = await refreshSingleCreator(admin, apiKey, { handle, channelId });
        if (!result) {
          return jsonResponse({ error: 'Could not resolve creator', code: 'NOT_FOUND' }, 404);
        }
        return jsonResponse({ ok: true, ...result });
      }

      const summary = await refreshAllEnabledCreators(admin, apiKey);
      return jsonResponse({ ok: true, ...summary });
    } catch (err) {
      console.error('creator-videos refresh failed', err);
      return jsonResponse({ error: 'Refresh failed', code: 'UPSTREAM_ERROR' }, 502);
    }
  }

  try {
    return await handlePublicAction(admin, body as PublicAction, limitKey);
  } catch (err) {
    console.error('creator-videos error', err);
    return jsonResponse({ error: 'Could not load creator recipes right now.', code: 'UPSTREAM_ERROR' }, 502);
  }
});
