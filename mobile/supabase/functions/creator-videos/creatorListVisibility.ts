import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import type { CreatorVideoOverrideAction } from './creatorVideoOverrides.ts';
import { isLowQualityFeedVideo } from './recipeVideoFilter.ts';

/** Rows needed to decide if a channel should appear in the creator avatar row. */
export interface CreatorListVideoRow {
  video_id: string;
  channel_id: string;
  title: string;
  description_snippet: string | null;
  is_short: boolean;
}

const POSTGREST_PAGE_SIZE = 1000;

/** Same visibility rules as the popular feed (hide overrides + non-recipe / low-quality filter). */
export function isVisibleInCreatorFeed(
  row: CreatorListVideoRow,
  hideOverrides: ReadonlyMap<string, CreatorVideoOverrideAction>,
): boolean {
  if (hideOverrides.get(row.video_id) === 'hide') return false;
  return !isLowQualityFeedVideo(row.title, row.description_snippet ?? '', {
    isShort: row.is_short,
  });
}

export function channelIdsWithVisibleFeedVideos(
  rows: readonly CreatorListVideoRow[],
  hideOverrides: ReadonlyMap<string, CreatorVideoOverrideAction>,
): Set<string> {
  const channelIds = new Set<string>();
  for (const row of rows) {
    if (isVisibleInCreatorFeed(row, hideOverrides)) {
      channelIds.add(row.channel_id);
    }
  }
  return channelIds;
}

export async function loadChannelIdsWithVisibleFeedVideos(
  admin: SupabaseClient,
  hideOverrides: ReadonlyMap<string, CreatorVideoOverrideAction>,
): Promise<Set<string>> {
  const channelIds = new Set<string>();
  let offset = 0;

  while (true) {
    const from = offset;
    const to = offset + POSTGREST_PAGE_SIZE - 1;
    const { data, error } = await admin
      .from('creator_videos')
      .select('video_id, channel_id, title, description_snippet, is_short')
      .order('video_id', { ascending: true })
      .range(from, to);
    if (error) throw error;

    const page = (data ?? []) as CreatorListVideoRow[];
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
