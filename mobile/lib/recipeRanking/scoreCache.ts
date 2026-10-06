import type { RecipeRankingBreakdown, RecipeRankingContext, RecipeRankingInput } from './types';
import { LruCache } from '../recipeMatch/lruCache';
import { scoreRecipeForRanking } from './scoreRecipe';
import type { EngagementIndexV2 } from './engagementIndex';

const SCORE_CACHE = new LruCache<string, RecipeRankingBreakdown>(8192);
let scoreCacheCtxKey = '';

export function clearRecipeRankingScoreCacheForTests(): void {
  SCORE_CACHE.clear();
  scoreCacheCtxKey = '';
  scoreCacheHits = 0;
  scoreCacheMisses = 0;
}

export function recipeRankingScoreCacheStatsForTests(): { hits: number; misses: number } {
  return { hits: scoreCacheHits, misses: scoreCacheMisses };
}

let scoreCacheHits = 0;
let scoreCacheMisses = 0;

function rankingInputFingerprint(input: RecipeRankingInput): string {
  const lines = input.ingredientLines ?? [];
  return `${input.refKey}\u0001${input.match.percentMatch}\u0001${input.match.matchedCount}\u0001${lines.join('\u0002')}`;
}

function rankingContextFingerprint(ctx: RecipeRankingContext): string {
  return JSON.stringify({
    diets: ctx.dietPrefs.diets,
    allergens: ctx.dietPrefs.allergens,
    dislikes: ctx.dietPrefs.dislikes,
    hideConflicts: ctx.dietPrefs.hideConflicts,
    householdSize: ctx.householdSize,
    tabFilters: ctx.tabFilters,
    pricingOwner: ctx.pricing.ownerId,
    eventsLen: ctx.events.length,
    personalSignalsReady: ctx.personalSignalsReady,
    engagementVersion: ctx.engagementIndex.version,
  });
}

export function scoreRecipeForRankingCached(
  input: RecipeRankingInput,
  ctx: RecipeRankingContext,
  costCache: Map<string, number | null>,
  nowMs?: number,
  engagementIndex?: EngagementIndexV2,
): RecipeRankingBreakdown {
  const ctxKey = rankingContextFingerprint(ctx);
  if (ctxKey !== scoreCacheCtxKey) {
    SCORE_CACHE.clear();
    scoreCacheCtxKey = ctxKey;
  }
  const cacheKey = `${ctxKey}\u0003${rankingInputFingerprint(input)}`;
  const hit = SCORE_CACHE.get(cacheKey);
  if (hit) {
    scoreCacheHits += 1;
    return hit;
  }
  scoreCacheMisses += 1;
  const breakdown = scoreRecipeForRanking(input, ctx, costCache, nowMs, engagementIndex);
  SCORE_CACHE.set(cacheKey, breakdown);
  return breakdown;
}
