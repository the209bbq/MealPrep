/** Top-level score weights (spec §2.4, peer reserved at 0). */
export const RANK_WEIGHT_FIT_COLD = 40;
export const RANK_WEIGHT_PERSONAL_COLD = 35;
export const RANK_WEIGHT_FIT_WARM = 30;
export const RANK_WEIGHT_PERSONAL_WARM = 45;
export const RANK_WEIGHT_PEER = 0;
export const RANK_WEIGHT_NOVELTY = 10;
export const RANK_WEIGHT_SUM =
  RANK_WEIGHT_FIT_COLD + RANK_WEIGHT_PERSONAL_COLD + RANK_WEIGHT_PEER + RANK_WEIGHT_NOVELTY;

/** Legacy exports (normalized fractions for cold profile). */
export const RANK_WEIGHT_FIT = RANK_WEIGHT_FIT_COLD / RANK_WEIGHT_SUM;
export const RANK_WEIGHT_PERSONAL = RANK_WEIGHT_PERSONAL_COLD / RANK_WEIGHT_SUM;
export const RANK_WEIGHT_NOVELTY_FRAC = RANK_WEIGHT_NOVELTY / RANK_WEIGHT_SUM;

/** Fit sub-weights (sum = 1). */
export const FIT_WEIGHT_PANTRY = 0.45;
export const FIT_WEIGHT_TIME = 0.25;
export const FIT_WEIGHT_BUDGET = 0.2;
export const FIT_WEIGHT_SERVINGS = 0.1;

/** Peer collaborative signal — reserved for later. */
export const PEER_SCORE_STUB = 0;

export const STRONG_EVENTS_FOR_WARM_WEIGHTS = 20;
