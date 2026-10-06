import type { RecipesTabRow } from '../../config/recipesTabFilters';
import type { CreatorFeedCardModel } from '../recipes/creatorFeedRows';
import type { RecipesSearchResultItem } from '../recipes/mergeSearchResults';
import { mergeRecipeSearchResults } from '../recipes/mergeSearchResults';
import {
  normalizeRecipeTitleForDedup,
  recipesTabRowDisplayName,
} from '../recipes/unifiedFeed';
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
      ctx.engagementIndex,
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
      ctx.engagementIndex,
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

function searchResultTitle(item: RecipesSearchResultItem): string {
  if (item.kind === 'classic') return recipesTabRowDisplayName(item.row);
  return item.model.video.title?.trim() || item.model.item.title;
}

/** Higher = better title match for the active search query. */
export function searchTitleMatchBoost(title: string, query: string): number {
  const q = normalizeRecipeTitleForDedup(query);
  if (!q) return 0;
  const t = normalizeRecipeTitleForDedup(title);
  if (!t) return 0;
  if (t === q) return 10_000;
  if (t.startsWith(q) || q.startsWith(t)) return 5_000;
  if (t.includes(q)) return 2_500;
  return 0;
}

export function rankRecipeSearchResults(
  items: readonly RecipesSearchResultItem[],
  ctx: RecipeRankingContext,
  nowMs?: number,
  searchQuery?: string,
): RecipesSearchResultItem[] {
  const query = searchQuery?.trim() ?? '';
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
  const merged = mergeRecipeSearchResults(rankedClassic, rankedVideos);
  if (!query) return merged;

  const withIndex = merged.map((item, index) => ({ item, index }));
  withIndex.sort((a, b) => {
    const boostA = searchTitleMatchBoost(searchResultTitle(a.item), query);
    const boostB = searchTitleMatchBoost(searchResultTitle(b.item), query);
    if (boostB !== boostA) return boostB - boostA;
    return a.index - b.index;
  });
  return withIndex.map((row) => row.item);
}
