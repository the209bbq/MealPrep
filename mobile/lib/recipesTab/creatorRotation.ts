import { RECIPES_TAB_SURFACE } from '../../config/recipesTabSurface';
import type { CreatorListItem } from '../creatorVideos/types';
import { betaMean, betaSample } from './betaSample';
import {
  aggregateCreatorEngagement,
  creatorHasStrongEvent,
  type CreatorEngagementTotals,
} from './creatorEngagement';
import { buildPopularityNormalizers, popularityPriorForCreator } from './creatorPopularity';
import type { CreatorSlotType } from './surfaceEvents';
import { countCreatorLifetimeImpressions } from './surfaceEvents';
import { createVisitRng, uniformJitter } from './seededRandom';
import type { RecipesTabVisitState } from './visitState';
import type { RecipeEngagementEvent } from '../recipeRanking/types';
import type { RecipesTabSurfaceEvent } from './surfaceEvents';

export interface CreatorRotationSlot {
  creator: CreatorListItem;
  position: number;
  slotType: CreatorSlotType;
  score: number;
}

export interface CreatorRotationInput {
  visitId: string;
  creators: readonly CreatorListItem[];
  passRateById: ReadonlyMap<string, number>;
  recipeEvents: readonly RecipeEngagementEvent[];
  surfaceEvents: readonly RecipesTabSurfaceEvent[];
  refKeyToCreatorId: ReadonlyMap<string, string>;
  visitState: RecipesTabVisitState;
  nowMs: number;
  rng?: () => number;
}

interface ScoredCreator {
  creator: CreatorListItem;
  theta: number;
  score: number;
  alpha: number;
  beta: number;
  totals: CreatorEngagementTotals;
  passRate: number;
  isFavorite: boolean;
}

function fatigueFactor(creatorId: string, visitState: RecipesTabVisitState): number {
  const recent = visitState.recentFirst5Visits ?? [];
  let count = 0;
  for (const visit of recent.slice(0, 3)) {
    if (visit.includes(creatorId)) count += 1;
  }
  return 1 - 0.15 * Math.min(4, count);
}

function scoreCreators(input: CreatorRotationInput): ScoredCreator[] {
  const rng = input.rng ?? createVisitRng(input.visitId);
  const { normalizeSubs, normalizeViews } = buildPopularityNormalizers(input.creators);
  const scored: ScoredCreator[] = [];

  for (const creator of input.creators) {
    const passRate = input.passRateById.get(creator.id) ?? 1;
    if (passRate < RECIPES_TAB_SURFACE.minPassRateToShow) continue;

    const totals = aggregateCreatorEngagement(
      creator.id,
      input.recipeEvents,
      input.surfaceEvents,
      input.refKeyToCreatorId,
      input.nowMs,
    );
    const pop = popularityPriorForCreator(creator, normalizeSubs, normalizeViews);
    const alpha = 1 + 2 * pop + totals.positivePoints / 2;
    const beta = 3 + totals.misses / 2;
    const theta = betaSample(alpha, beta, rng);
    const dietFactor = Math.min(1, passRate / RECIPES_TAB_SURFACE.dietPassRateHalfPoint);
    const fatigue = fatigueFactor(creator.id, input.visitState);
    const score = theta * dietFactor * fatigue;
    scored.push({
      creator,
      theta,
      score,
      alpha,
      beta,
      totals,
      passRate,
      isFavorite: creatorHasStrongEvent(totals),
    });
  }

  return scored.sort((a, b) => b.score - a.score);
}

function pickFavorites(scored: ScoredCreator[], rng: () => number): ScoredCreator[] {
  const favorites = scored
    .filter((row) => row.isFavorite)
    .sort((a, b) => betaMean(b.alpha, b.beta) - betaMean(a.alpha, a.beta))
    .slice(0, 3);
  if (favorites.length === 0) return [];
  if (favorites.length <= 2) return favorites;
  const weighted = [...favorites].sort((a, b) => b.theta - a.theta || rng() - 0.5);
  return weighted.slice(0, 2);
}

function applyExplorationSwap(
  ordered: ScoredCreator[],
  surfaceEvents: readonly RecipesTabSurfaceEvent[],
  rng: () => number,
): ScoredCreator[] {
  const first5 = ordered.slice(0, 5);
  if (first5.length < 5) return ordered;
  const hasLowImpression = first5.some(
    (row) =>
      countCreatorLifetimeImpressions(surfaceEvents, row.creator.id) <
      RECIPES_TAB_SURFACE.minLifetimeImpressionsForExploration,
  );
  if (hasLowImpression) return ordered;
  if (rng() > RECIPES_TAB_SURFACE.explorationSwapProbability) return ordered;

  const explore = ordered.find(
    (row) =>
      countCreatorLifetimeImpressions(surfaceEvents, row.creator.id) <
      RECIPES_TAB_SURFACE.minLifetimeImpressionsForExploration,
  );
  if (!explore) return ordered;
  const next = [...ordered];
  const exploreIdx = next.findIndex((row) => row.creator.id === explore.creator.id);
  if (exploreIdx < 0) return ordered;
  const removed = next.splice(exploreIdx, 1)[0]!;
  next[4] = removed;
  return next;
}

function ensureFavoritesInFirstFive(ordered: ScoredCreator[]): ScoredCreator[] {
  if (ordered.slice(0, 5).some((row) => row.isFavorite)) return ordered;
  const favorite = ordered.find((row) => row.isFavorite);
  if (!favorite) return ordered;
  const next = ordered.filter((row) => row.creator.id !== favorite.creator.id);
  next.splice(Math.min(4, next.length), 0, favorite);
  return next;
}

function applyNoRepeatRule(
  ordered: ScoredCreator[],
  visitState: RecipesTabVisitState,
): ScoredCreator[] {
  const last = visitState.lastFirst5Creators ?? [];
  if (last.length === 0) return ordered;

  const next = [...ordered];
  const first5Ids = () => next.slice(0, 5).map((row) => row.creator.id);
  const overlap = () => first5Ids().filter((id) => last.includes(id)).length;

  let guard = 0;
  while (overlap() >= 4 && guard < 20) {
    guard += 1;
    const first5 = next.slice(0, 5);
    const favorites = new Set(
      first5.filter((row) => row.isFavorite).map((row) => row.creator.id),
    );
    const replaceable = [...first5]
      .map((row, index) => ({ row, index }))
      .filter(({ row, index }) => index >= 2 && !favorites.has(row.creator.id))
      .sort((a, b) => a.row.score - b.row.score);
    const replacement = next.find(
      (row, index) => index >= 5 && !first5Ids().includes(row.creator.id),
    );
    if (!replaceable.length || !replacement) break;
    const slot = replaceable[0]!.index;
    const removed = next.splice(
      next.findIndex((r) => r.creator.id === replaceable[0]!.row.creator.id),
      1,
    )[0]!;
    const replIdx = next.findIndex((r) => r.creator.id === replacement.creator.id);
    next.splice(replIdx, 1);
    next.splice(slot, 0, replacement);
    next.push(removed);
  }

  const sameOrder =
    last.length >= 5 &&
    first5Ids().length >= 5 &&
    first5Ids().every((id, index) => id === last[index]);
  if (sameOrder && next.length >= 2) {
    const a = next[0]!;
    next[0] = next[1]!;
    next[1] = a;
  }

  return next;
}

export function buildCreatorRotation(input: CreatorRotationInput): CreatorRotationSlot[] {
  const rng = input.rng ?? createVisitRng(input.visitId);
  const scored = scoreCreators(input);
  if (scored.length === 0) return [];

  const favorites = pickFavorites(scored, rng);
  const favoriteIds = new Set(favorites.map((row) => row.creator.id));
  const rest = scored.filter((row) => !favoriteIds.has(row.creator.id));

  const ordered: ScoredCreator[] = [];
  for (const fav of favorites) ordered.push(fav);
  while (ordered.length < 2 && rest.length > 0) {
    ordered.push(rest.shift()!);
  }
  for (const row of rest) {
    if (ordered.length >= 5) break;
    ordered.push(row);
  }
  for (const row of scored) {
    if (ordered.some((existing) => existing.creator.id === row.creator.id)) continue;
    ordered.push(row);
  }

  let adjusted = applyExplorationSwap(ordered, input.surfaceEvents, rng);
  adjusted = applyNoRepeatRule(adjusted, input.visitState);
  adjusted = ensureFavoritesInFirstFive(adjusted);

  return adjusted.map((row, index) => {
    const position = index + 1;
    let slotType: CreatorSlotType = 'sample';
    if (position <= 2 && row.isFavorite && favoriteIds.has(row.creator.id)) {
      slotType = 'favorite';
    } else if (
      countCreatorLifetimeImpressions(input.surfaceEvents, row.creator.id) <
      RECIPES_TAB_SURFACE.minLifetimeImpressionsForExploration
    ) {
      slotType = 'explore';
    }
    return {
      creator: row.creator,
      position,
      slotType,
      score: row.score + uniformJitter(rng, 0),
    };
  });
}

export function first5CreatorIds(slots: readonly CreatorRotationSlot[]): string[] {
  return slots.slice(0, 5).map((slot) => slot.creator.id);
}
