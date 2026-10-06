import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isCreatorRecipesConfigured } from '../config/appConfig';
import type { CreatorRecipesBrowseMode } from '../config/creatorRecipes';
import {
  CreatorVideosNotConfiguredError,
  CreatorVideosUpstreamError,
  fetchCreatorChannelVideos,
  fetchCreatorFeed,
  fetchCreatorList,
  readPersistedCreatorList,
} from '../lib/creatorVideos/client';
import { compareCreatorsByFitAndSubscribers } from '../lib/creatorVideos/fitOrder';
import type { CreatorListItem, CreatorVideoItem } from '../lib/creatorVideos/types';

export function useCreatorList(session: Session | null, options?: { enabled?: boolean }) {
  const configured = isCreatorRecipesConfigured();
  const enabled = configured && (options?.enabled ?? true);
  const [creators, setCreators] = useState<CreatorListItem[]>(() =>
    enabled ? readPersistedCreatorList() : [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setCreators([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchCreatorList(session?.access_token ?? null);
      setCreators([...rows].sort(compareCreatorsByFitAndSubscribers));
    } catch (err) {
      setCreators([]);
      if (err instanceof CreatorVideosNotConfiguredError) {
        setError(null);
      } else if (err instanceof CreatorVideosUpstreamError) {
        setError(err.message);
      } else {
        setError('Could not load creators right now.');
      }
    } finally {
      setLoading(false);
    }
  }, [enabled, session?.access_token]);

  useEffect(() => {
    void load();
  }, [load]);

  return { creators, loading, error, configured, refresh: load };
}

export function useCreatorFeed(
  session: Session | null,
  mode: CreatorRecipesBrowseMode,
  options?: { enabled?: boolean },
) {
  const configured = isCreatorRecipesConfigured();
  const enabled = configured && (options?.enabled ?? true);
  const [videos, setVideos] = useState<CreatorVideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setVideos([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCreatorFeed(mode, session?.access_token ?? null);
      setVideos(result.videos);
    } catch (err) {
      setVideos([]);
      if (err instanceof CreatorVideosNotConfiguredError) {
        setError(null);
      } else if (err instanceof CreatorVideosUpstreamError) {
        setError(err.message);
      } else {
        setError('Could not load videos right now.');
      }
    } finally {
      setLoading(false);
    }
  }, [enabled, mode, session?.access_token]);

  useEffect(() => {
    void load();
  }, [load]);

  return { videos, loading, error, configured, refresh: load };
}

export function useCreatorChannelVideos(
  session: Session | null,
  channelId: string | null,
  options?: { enabled?: boolean },
) {
  const configured = isCreatorRecipesConfigured();
  const enabled = configured && Boolean(channelId) && (options?.enabled ?? true);
  const [creator, setCreator] = useState<CreatorListItem | null>(null);
  const [videos, setVideos] = useState<CreatorVideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !channelId) {
      setCreator(null);
      setVideos([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCreatorChannelVideos(channelId, session?.access_token ?? null);
      setCreator(result.creator);
      setVideos(result.videos);
    } catch (err) {
      setCreator(null);
      setVideos([]);
      if (err instanceof CreatorVideosNotConfiguredError) {
        setError(null);
      } else if (err instanceof CreatorVideosUpstreamError) {
        setError(err.message);
      } else {
        setError('Could not load this creator right now.');
      }
    } finally {
      setLoading(false);
    }
  }, [channelId, enabled, session?.access_token]);

  useEffect(() => {
    void load();
  }, [load]);

  return { creator, videos, loading, error, configured, refresh: load };
}
