import type { RecipesTabRow } from '../../config/recipesTabFilters';
import type { CreatorFeedCardModel } from './creatorFeedRows';
import { normalizeRecipeTitleForDedup } from './unifiedFeed';

export type RecipesSearchResultItem =
  | { kind: 'classic'; row: RecipesTabRow }
  | { kind: 'creator_video'; model: CreatorFeedCardModel };

function classicKey(row: RecipesTabRow): string {
  return `classic:${normalizeRecipeTitleForDedup(row.recipe.name)}`;
}

function videoKey(model: CreatorFeedCardModel): string {
  return `video:${model.videoId}`;
}

/**
 * Interleave MealDB + creator video hits so neither source dominates the list.
 */
export function mergeRecipeSearchResults(
  classicRows: readonly RecipesTabRow[],
  videoModels: readonly CreatorFeedCardModel[],
): RecipesSearchResultItem[] {
  const classicItems: RecipesSearchResultItem[] = classicRows.map((row) => ({
    kind: 'classic',
    row,
  }));
  const videoItems: RecipesSearchResultItem[] = videoModels.map((model) => ({
    kind: 'creator_video',
    model,
  }));

  const merged: RecipesSearchResultItem[] = [];
  const seen = new Set<string>();
  let ci = 0;
  let vi = 0;
  let preferVideo = false;

  while (ci < classicItems.length || vi < videoItems.length) {
    const takeVideo =
      vi < videoItems.length &&
      (ci >= classicItems.length || (preferVideo && ci < classicItems.length));
    const item = takeVideo ? videoItems[vi++]! : classicItems[ci++]!;
    preferVideo = !preferVideo;

    const key =
      item.kind === 'classic' ? classicKey(item.row) : videoKey(item.model);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}
