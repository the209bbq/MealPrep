import type { RecipesTabRow } from '../../config/recipesTabFilters';
import type { CreatorFeedCardModel } from '../recipes/creatorFeedRows';
import type { RecipesSearchResultItem } from '../recipes/mergeSearchResults';
import { mergeRecipeSearchResults } from '../recipes/mergeSearchResults';
import { scoreRecipeForRanking } from './scoreRecipe';
import type { RecipeRankingContext } from './types';
import { rankingInputFromCreatorModel, rankingInputFromRecipesTabRow } from './recipeInputs';

export function rankRecipesTabRows(
  rows: readonly RecipesTabRow[],
  ctx: RecipeRankingContext,
  nowMs?: number,
): RecipesTabRow[] {
  const costCache = new Map<string, number | null>();
  const scored = rows.map((row, index) => ({
    row,
    index,
    breakdown: scoreRecipeForRanking(
      rankingInputFromRecipesTabRow(row),
      ctx,
      costCache,
      nowMs,
    ),
  }));
  return scored
    .filter((entry) => !entry.breakdown.hardExcluded)
    .sort((a, b) => {
      if (b.breakdown.total !== a.breakdown.total) {
        return b.breakdown.total - a.breakdown.total;
      }
      return a.index - b.index;
    })
    .map((entry) => entry.row);
}

export function rankCreatorFeedModels(
  models: readonly CreatorFeedCardModel[],
  ctx: RecipeRankingContext,
  nowMs?: number,
): CreatorFeedCardModel[] {
  const costCache = new Map<string, number | null>();
  const scored = models.map((model, index) => ({
    model,
    index,
    breakdown: scoreRecipeForRanking(
      rankingInputFromCreatorModel(model),
      ctx,
      costCache,
      nowMs,
    ),
  }));
  return scored
    .filter((entry) => !entry.breakdown.hardExcluded)
    .sort((a, b) => {
      if (b.breakdown.total !== a.breakdown.total) {
        return b.breakdown.total - a.breakdown.total;
      }
      return a.index - b.index;
    })
    .map((entry) => entry.model);
}

export function rankRecipeSearchResults(
  items: readonly RecipesSearchResultItem[],
  ctx: RecipeRankingContext,
  nowMs?: number,
): RecipesSearchResultItem[] {
  const classicRows = items
    .filter((item): item is Extract<RecipesSearchResultItem, { kind: 'classic' }> => item.kind === 'classic')
    .map((item) => item.row);
  const videoModels = items
    .filter(
      (item): item is Extract<RecipesSearchResultItem, { kind: 'creator_video' }> =>
        item.kind === 'creator_video',
    )
    .map((item) => item.model);
  const rankedClassic = rankRecipesTabRows(classicRows, ctx, nowMs);
  const rankedVideos = rankCreatorFeedModels(videoModels, ctx, nowMs);
  return mergeRecipeSearchResults(rankedClassic, rankedVideos);
}
