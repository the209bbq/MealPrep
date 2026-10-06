import {
  RANK_WEIGHT_FIT_COLD,
  RANK_WEIGHT_FIT_WARM,
  RANK_WEIGHT_NOVELTY,
  RANK_WEIGHT_PERSONAL_COLD,
  RANK_WEIGHT_PERSONAL_WARM,
  RANK_WEIGHT_PEER,
  RANK_WEIGHT_SUM,
  PEER_SCORE_STUB,
  STRONG_EVENTS_FOR_WARM_WEIGHTS,
} from './weights';
import type { RecipeRankingContext, RecipeRankingInput, RecipeRankingBreakdown } from './types';
import { shouldHardExcludeRecipe } from './hardFilter';
import { scoreRecipeFit } from './fitScore';
import { scorePersonalV2 } from './personalScore';
import { scoreNoveltyFromIndex } from './noveltyScore';
import { repetitionScoreAdjust } from './repetitionAdjust';
import type { EngagementIndexV2 } from './engagementIndex';
import { countStrongEvents } from './engagementIndex';
import { recipeFeaturesFromRankingInput } from './recipeFeatures';

function topLevelWeights(strongN: number): {
  fit: number;
  personal: number;
  peer: number;
  novelty: number;
} {
  const warm = strongN >= STRONG_EVENTS_FOR_WARM_WEIGHTS;
  const fitW = warm ? RANK_WEIGHT_FIT_WARM : RANK_WEIGHT_FIT_COLD;
  const personalW = warm ? RANK_WEIGHT_PERSONAL_WARM : RANK_WEIGHT_PERSONAL_COLD;
  const sum = fitW + personalW + RANK_WEIGHT_PEER + RANK_WEIGHT_NOVELTY;
  return {
    fit: fitW / sum,
    personal: personalW / sum,
    peer: RANK_WEIGHT_PEER / sum,
    novelty: RANK_WEIGHT_NOVELTY / sum,
  };
}

function whyReason(
  input: RecipeRankingInput,
  fit: number,
  personal: number,
  novelty: number,
  matchPercent: number,
): string | undefined {
  const features = recipeFeaturesFromRankingInput(input);
  const terms: { label: string; value: number }[] = [
    { label: `Uses ${Math.round(matchPercent)}% of what you have`, value: fit * 0.45 },
    { label: `You cook a lot of ${features.group}`, value: personal },
    { label: 'Quick weeknight pick', value: input.recipe.minutes <= 30 ? fit * 0.25 : 0 },
    { label: 'New for you', value: novelty },
  ];
  terms.sort((a, b) => b.value - a.value);
  return terms[0]?.value > 0 ? terms[0].label : undefined;
}

export function scoreRecipeForRanking(
  input: RecipeRankingInput,
  ctx: RecipeRankingContext,
  costCache: Map<string, number | null>,
  nowMs: number = Date.now(),
  engagementIndex?: EngagementIndexV2,
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

  const index =
    engagementIndex ??
    ({
      version: 2,
      tasteLastMs: nowMs,
      tasteRecipe: {},
      tasteGroup: {},
      tasteArea: {},
      tasteTag: {},
      strongEventTimestamps: [],
      impressionFatigue: {},
      cookDeclinedAt: {},
      cookConfirmedTotal: {},
      lastCookConfirmedMs: {},
      impressions14d: {},
      openedAfterImpression: {},
      ghostSlot: {},
      ghostWeekday: { B: {}, L: {}, D: {} },
      ghostOutcomes: {},
      compactPromptOn: {},
      ghostLastMs: nowMs,
    } satisfies EngagementIndexV2);

  const fit = scoreRecipeFit(
    input.recipe,
    input.match,
    ctx.householdSize,
    ctx.tabFilters,
    ctx.pricing,
    costCache,
  );
  const personal = scorePersonalV2(input, index, ctx.dietPrefs, ctx.householdSize, nowMs);
  const peer = PEER_SCORE_STUB;
  const novelty = scoreNoveltyFromIndex(input.refKey, index, nowMs);
  const strongN = countStrongEvents(index, nowMs);
  const weights = topLevelWeights(strongN);
  const repetitionAdjust = repetitionScoreAdjust(input.refKey, index, nowMs);
  const total =
    fit * weights.fit +
    personal * weights.personal +
    peer * weights.peer +
    novelty * weights.novelty +
    repetitionAdjust;

  return {
    refKey: input.refKey,
    total: Math.max(0, total),
    fit,
    personal,
    peer,
    novelty,
    hardExcluded: false,
    repetitionAdjust,
    reason: whyReason(input, fit, personal, novelty, input.match.percentMatch),
  };
}
