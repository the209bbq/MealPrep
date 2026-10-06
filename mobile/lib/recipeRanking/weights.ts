import type { RecipeEngagementEventType } from './types';

/** Top-level score weights (sum = 1). */
export const RANK_WEIGHT_FIT = 0.4;
export const RANK_WEIGHT_PERSONAL = 0.35;
export const RANK_WEIGHT_PEER = 0.15;
export const RANK_WEIGHT_NOVELTY = 0.1;

/** Fit sub-weights (sum = 1). */
export const FIT_WEIGHT_PANTRY = 0.45;
export const FIT_WEIGHT_TIME = 0.25;
export const FIT_WEIGHT_BUDGET = 0.2;
export const FIT_WEIGHT_SERVINGS = 0.1;

/** Peer collaborative signal — v1 stub (near zero). */
export const PEER_SCORE_STUB = 0;

export const RECENCY_HALF_LIFE_DAYS = 14;

export const SIGNAL_WEIGHTS: Record<
  Exclude<
    RecipeEngagementEventType,
    | 'impression'
    | 'wont_cook'
    | 'plan'
    | 'cook_now'
    | 'just_save'
    | 'cook_confirmed'
    | 'cook_declined'
  >,
  number
> = {
  open: 0.12,
  cook: 1,
  save: 0.85,
  like: 0.9,
  skip: -0.55,
};
