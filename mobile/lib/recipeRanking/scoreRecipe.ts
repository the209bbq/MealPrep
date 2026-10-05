import {
  RANK_WEIGHT_FIT,
  RANK_WEIGHT_NOVELTY,
  RANK_WEIGHT_PEER,
  RANK_WEIGHT_PERSONAL,
  PEER_SCORE_STUB,
} from './weights';
import type { RecipeRankingContext, RecipeRankingInput, RecipeRankingBreakdown } from './types';
import { shouldHardExcludeRecipe } from './hardFilter';
import { scoreRecipeFit } from './fitScore';
import { scorePersonalHistory } from './personalScore';
import { scoreNovelty } from './noveltyScore';

function effectiveWeights(personalReady: boolean): {
  fit: number;
  personal: number;
  peer: number;
  novelty: number;
} {
  if (personalReady) {
    return {
      fit: RANK_WEIGHT_FIT,
      personal: RANK_WEIGHT_PERSONAL,
      peer: RANK_WEIGHT_PEER,
      novelty: RANK_WEIGHT_NOVELTY,
    };
  }
  const active = RANK_WEIGHT_FIT + RANK_WEIGHT_NOVELTY;
  const scale = active > 0 ? 1 / active : 1;
  return {
    fit: RANK_WEIGHT_FIT * scale,
    personal: 0,
    peer: 0,
    novelty: RANK_WEIGHT_NOVELTY * scale,
  };
}

export function scoreRecipeForRanking(
  input: RecipeRankingInput,
  ctx: RecipeRankingContext,
  costCache: Map<string, number | null>,
  nowMs: number = Date.now(),
): RecipeRankingBreakdown {
  const hardExcluded = shouldHardExcludeRecipe(
    ctx.dietPrefs,
    input.ingredientLines,
    input.refKey,
    ctx.events,
  );
  if (hardExcluded) {
    return {
      refKey: input.refKey,
      total: 0,
      fit: 0,
      personal: 0,
      peer: 0,
      novelty: 0,
      hardExcluded: true,
    };
  }

  const fit = scoreRecipeFit(
    input.recipe,
    input.match,
    ctx.householdSize,
    ctx.tabFilters,
    ctx.pricing,
    costCache,
  );
  const personal = ctx.personalSignalsReady
    ? scorePersonalHistory(input.refKey, ctx.events, nowMs)
    : 0;
  const peer = ctx.personalSignalsReady ? PEER_SCORE_STUB : 0;
  const novelty = scoreNovelty(input.refKey, ctx.events, nowMs);
  const weights = effectiveWeights(ctx.personalSignalsReady);
  const total =
    fit * weights.fit +
    personal * weights.personal +
    peer * weights.peer +
    novelty * weights.novelty;

  return {
    refKey: input.refKey,
    total,
    fit,
    personal,
    peer,
    novelty,
    hardExcluded: false,
  };
}
