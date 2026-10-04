import {
  getCreatorVideosUrl,
  isDemoMode,
  SUPABASE_ANON_KEY,
} from '../../config/appConfig';
import {
  CREATOR_RECIPES,
  CREATOR_RECIPES_COPY,
  type CreatorRecipesBrowseMode,
} from '../../config/creatorRecipes';
import { withTimeout } from '../withTimeout';
import { demoCreatorVideos, demoCreators } from './demoSamples';
import type {
  CreatorListItem,
  CreatorVideoItem,
  CreatorVideosErrorEnvelope,
  CreatorVideosFeedResult,
} from './types';

export class CreatorVideosNotConfiguredError extends Error {
  code = 'NOT_CONFIGURED';
}

export class CreatorVideosRateLimitError extends Error {
  code = 'RATE_LIMIT';
}

export class CreatorVideosUpstreamError extends Error {
  code = 'UPSTREAM_ERROR';
}

const memoryCache = new Map<string, { payload: unknown; expiresAt: number }>();

function cacheKey(parts: string[]): string {
  return parts.join(':');
}

function readCache<T>(key: string): T | null {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return hit.payload as T;
}

function writeCache(key: string, payload: unknown): void {
  memoryCache.set(key, {
    payload,
    expiresAt: Date.now() + CREATOR_RECIPES.clientCacheTtlMs,
  });
}

async function parseError(response: Response, text: string): Promise<never> {
  let json: CreatorVideosErrorEnvelope = {};
  try {
    json = JSON.parse(text) as CreatorVideosErrorEnvelope;
  } catch {
    /* ignore */
  }
  const message = json.error ?? CREATOR_RECIPES_COPY.error;
  if (response.status === 503 || json.code === 'NOT_CONFIGURED') {
    throw new CreatorVideosNotConfiguredError(message);
  }
  if (response.status === 429 || json.code === 'RATE_LIMIT') {
    throw new CreatorVideosRateLimitError(message);
  }
  throw new CreatorVideosUpstreamError(message);
}

async function postCreatorVideos<T>(
  body: Record<string, unknown>,
  accessToken: string | null,
): Promise<T> {
  const endpoint = getCreatorVideosUrl();
  if (!endpoint) {
    throw new CreatorVideosNotConfiguredError('Creator recipes are not available on this app yet.');
  }

  const bearer = accessToken?.trim() || SUPABASE_ANON_KEY.trim();
  if (!bearer) {
    throw new CreatorVideosNotConfiguredError('Creator recipes are not available on this app yet.');
  }

  const response = await withTimeout(
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearer}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    }),
    CREATOR_RECIPES.requestTimeoutMs,
    'Creator recipes request timed out',
  );

  const text = await response.text();
  if (!response.ok) {
    await parseError(response, text);
  }
  return JSON.parse(text) as T;
}

export async function fetchCreatorList(accessToken: string | null): Promise<CreatorListItem[]> {
  if (isDemoMode()) return demoCreators;

  const key = cacheKey(['creators']);
  const cached = readCache<CreatorListItem[]>(key);
  if (cached) return cached;

  const json = await postCreatorVideos<{ creators: CreatorListItem[] }>(
    { action: 'creators' },
    accessToken,
  );
  const creators = json.creators ?? [];
  writeCache(key, creators);
  return creators;
}

export async function fetchCreatorFeed(
  mode: CreatorRecipesBrowseMode,
  accessToken: string | null,
): Promise<CreatorVideosFeedResult> {
  if (isDemoMode()) {
    return { mode, videos: demoCreatorVideos() };
  }

  const key = cacheKey(['feed', mode]);
  const cached = readCache<CreatorVideosFeedResult>(key);
  if (cached) return cached;

  const json = await postCreatorVideos<{ mode: CreatorRecipesBrowseMode; videos: CreatorVideoItem[] }>(
    { action: 'feed', mode },
    accessToken,
  );
  const result = { mode: json.mode ?? mode, videos: json.videos ?? [] };
  writeCache(key, result);
  return result;
}

export async function fetchCreatorChannelVideos(
  channelId: string,
  accessToken: string | null,
): Promise<{ creator: CreatorListItem | null; videos: CreatorVideoItem[] }> {
  if (isDemoMode()) {
    const creator = demoCreators.find((row) => row.youtubeChannelId === channelId) ?? null;
    const videos = demoCreatorVideos().filter((row) => row.channelId === channelId);
    return { creator, videos };
  }

  const key = cacheKey(['creator', channelId]);
  const cached = readCache<{ creator: CreatorListItem | null; videos: CreatorVideoItem[] }>(key);
  if (cached) return cached;

  const json = await postCreatorVideos<{
    creator: CreatorListItem | null;
    videos: CreatorVideoItem[];
  }>({ action: 'creator', channelId }, accessToken);
  const payload = { creator: json.creator ?? null, videos: json.videos ?? [] };
  writeCache(key, payload);
  return payload;
}

export async function searchCreatorVideos(
  query: string,
  accessToken: string | null,
): Promise<CreatorVideoItem[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  if (isDemoMode()) {
    const haystack = q.toLowerCase();
    return demoCreatorVideos().filter(
      (row) =>
        row.title.toLowerCase().includes(haystack) ||
        row.creatorName.toLowerCase().includes(haystack),
    );
  }

  const json = await postCreatorVideos<{ videos: CreatorVideoItem[] }>(
    { action: 'search', q },
    accessToken,
  );
  return json.videos ?? [];
}
