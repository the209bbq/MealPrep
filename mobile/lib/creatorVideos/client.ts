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
import { readJson, writeJson } from '../storage';
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

const CREATOR_VIDEOS_CACHE_PREFIX = 'mealprep.creatorVideos';

interface CreatorCacheEntry {
  payload: unknown;
  expiresAt: number;
}

const memoryCache = new Map<string, CreatorCacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

function cacheKey(parts: string[]): string {
  return parts.join(':');
}

function persistentStorageKey(key: string): string {
  return `${CREATOR_VIDEOS_CACHE_PREFIX}:${key}`;
}

function readCacheEntry(key: string): CreatorCacheEntry | null {
  const hit = memoryCache.get(key);
  if (hit) return hit;
  const persisted = readJson<CreatorCacheEntry | null>(persistentStorageKey(key), null);
  if (!persisted) return null;
  memoryCache.set(key, persisted);
  return persisted;
}

function cacheFresh(entry: CreatorCacheEntry): boolean {
  return entry.expiresAt >= Date.now();
}

function writeCache(key: string, payload: unknown): void {
  const entry: CreatorCacheEntry = {
    payload,
    expiresAt: Date.now() + CREATOR_RECIPES.clientCacheTtlMs,
  };
  memoryCache.set(key, entry);
  writeJson(persistentStorageKey(key), entry);
}

async function revalidateCreatorCache<T>(
  key: string,
  loader: () => Promise<T>,
): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = loader().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

/** Clears in-memory creator video caches (for unit tests). */
export function resetCreatorVideosClientCacheForTests(): void {
  memoryCache.clear();
  inFlight.clear();
}

/** Sync hydration for creator list (stale-while-revalidate). */
export function readPersistedCreatorList(): CreatorListItem[] {
  const key = cacheKey(['creators']);
  const entry = readCacheEntry(key);
  if (!entry) return [];
  const creators = entry.payload as CreatorListItem[];
  return Array.isArray(creators) ? creators : [];
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
  const entry = readCacheEntry(key);
  if (entry && cacheFresh(entry)) {
    return entry.payload as CreatorListItem[];
  }
  if (entry) {
    void revalidateCreatorCache(key, async () => {
      const json = await postCreatorVideos<{ creators: CreatorListItem[] }>(
        { action: 'creators' },
        accessToken,
      );
      const creators = json.creators ?? [];
      writeCache(key, creators);
      return creators;
    });
    return entry.payload as CreatorListItem[];
  }

  return revalidateCreatorCache(key, async () => {
    const json = await postCreatorVideos<{ creators: CreatorListItem[] }>(
      { action: 'creators' },
      accessToken,
    );
    const creators = json.creators ?? [];
    writeCache(key, creators);
    return creators;
  });
}

export async function fetchCreatorFeed(
  mode: CreatorRecipesBrowseMode,
  accessToken: string | null,
): Promise<CreatorVideosFeedResult> {
  if (isDemoMode()) {
    return { mode, videos: demoCreatorVideos() };
  }

  const key = cacheKey(['feed', mode]);
  const entry = readCacheEntry(key);
  if (entry && cacheFresh(entry)) {
    return entry.payload as CreatorVideosFeedResult;
  }
  if (entry) {
    void revalidateCreatorCache(key, async () => {
      const json = await postCreatorVideos<{ mode: CreatorRecipesBrowseMode; videos: CreatorVideoItem[] }>(
        { action: 'feed', mode },
        accessToken,
      );
      const result = { mode: json.mode ?? mode, videos: json.videos ?? [] };
      writeCache(key, result);
      return result;
    });
    return entry.payload as CreatorVideosFeedResult;
  }

  return revalidateCreatorCache(key, async () => {
    const json = await postCreatorVideos<{ mode: CreatorRecipesBrowseMode; videos: CreatorVideoItem[] }>(
      { action: 'feed', mode },
      accessToken,
    );
    const result = { mode: json.mode ?? mode, videos: json.videos ?? [] };
    writeCache(key, result);
    return result;
  });
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
  const entry = readCacheEntry(key);
  if (entry && cacheFresh(entry)) {
    return entry.payload as { creator: CreatorListItem | null; videos: CreatorVideoItem[] };
  }
  if (entry) {
    void revalidateCreatorCache(key, async () => {
      const json = await postCreatorVideos<{
        creator: CreatorListItem | null;
        videos: CreatorVideoItem[];
      }>({ action: 'creator', channelId }, accessToken);
      const payload = { creator: json.creator ?? null, videos: json.videos ?? [] };
      writeCache(key, payload);
      return payload;
    });
    return entry.payload as { creator: CreatorListItem | null; videos: CreatorVideoItem[] };
  }

  return revalidateCreatorCache(key, async () => {
    const json = await postCreatorVideos<{
      creator: CreatorListItem | null;
      videos: CreatorVideoItem[];
    }>({ action: 'creator', channelId }, accessToken);
    const payload = { creator: json.creator ?? null, videos: json.videos ?? [] };
    writeCache(key, payload);
    return payload;
  });
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
