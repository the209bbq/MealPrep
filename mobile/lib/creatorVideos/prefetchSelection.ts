import { CREATOR_RECIPES } from '../../config/creatorRecipes';

/**
 * Which creator channels Home warms in the background.
 *
 * Home used to pass every creator bubble, so each device fired one `creator-videos` request per
 * creator (dozens) on open and on pull-to-refresh. Only the first few are warmed now; any other
 * creator loads when its bubble is tapped.
 */
export function selectCreatorPrefetchChannelIds(
  requested: readonly string[] | undefined,
  rankedFallback: readonly string[],
  limit: number = CREATOR_RECIPES.homePrefetchChannelLimit,
): string[] {
  const source = requested && requested.length > 0 ? requested : rankedFallback;
  const max = Math.max(0, Math.floor(limit));
  const picked: string[] = [];
  if (max === 0) return picked;
  for (const id of source) {
    if (!id || picked.includes(id)) continue;
    picked.push(id);
    if (picked.length >= max) break;
  }
  return picked;
}
