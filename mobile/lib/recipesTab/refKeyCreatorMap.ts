import type { CreatorVideoItem } from '../creatorVideos/types';
import type { CreatorListItem } from '../creatorVideos/types';

export function buildRefKeyToCreatorIdMap(
  creators: readonly CreatorListItem[],
  videos: readonly CreatorVideoItem[],
): Map<string, string> {
  const channelToId = new Map(creators.map((row) => [row.youtubeChannelId, row.id]));
  const map = new Map<string, string>();
  for (const video of videos) {
    const creatorId = channelToId.get(video.channelId);
    if (!creatorId) continue;
    map.set(`creator:${video.videoId}`, creatorId);
  }
  return map;
}
