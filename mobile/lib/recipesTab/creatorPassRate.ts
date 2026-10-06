import type { CreatorVideoItem } from '../creatorVideos/types';
import type { UserDietPrefs } from '../diet/types';
import { shouldHideRecipeForDietPrefs } from '../diet/conflicts';
import { ingredientLinesFromCreatorVideo } from '../diet/ingredientLines';

export function computeCreatorPassRate(
  videos: readonly CreatorVideoItem[],
  prefs: UserDietPrefs,
): number {
  if (!prefs.hideConflicts || videos.length === 0) return 1;
  let pass = 0;
  for (const video of videos) {
    const lines = ingredientLinesFromCreatorVideo(video);
    if (!shouldHideRecipeForDietPrefs(prefs, lines)) pass += 1;
  }
  return pass / videos.length;
}

export function groupVideosByChannelId(
  videos: readonly CreatorVideoItem[],
): Map<string, CreatorVideoItem[]> {
  const map = new Map<string, CreatorVideoItem[]>();
  for (const video of videos) {
    const list = map.get(video.channelId) ?? [];
    list.push(video);
    map.set(video.channelId, list);
  }
  return map;
}

export function passRateByCreatorId(
  creators: readonly { id: string; youtubeChannelId: string }[],
  videosByChannel: ReadonlyMap<string, readonly CreatorVideoItem[]>,
  prefs: UserDietPrefs,
): Map<string, number> {
  const rates = new Map<string, number>();
  for (const creator of creators) {
    const videos = videosByChannel.get(creator.youtubeChannelId) ?? [];
    rates.set(creator.id, computeCreatorPassRate(videos, prefs));
  }
  return rates;
}
