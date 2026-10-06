import { RECIPES_TAB_SURFACE } from '../../config/recipesTabSurface';
import type { RecipeEngagementEvent } from '../recipeRanking/types';
import type { RecipesTabSurfaceEvent } from './surfaceEvents';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const POSITIVE_POINTS: Partial<Record<string, number>> = {
  cook_confirmed: 5,
  cook: 5,
  plan: 3,
  import: 3,
  save: 2,
  just_save: 2,
  cook_now: 2,
  creator_open: 1,
  open: 0.5,
};

const STRONG_CREATOR_EVENTS = new Set(['plan', 'save', 'just_save', 'cook_confirmed', 'cook', 'import']);

function decayFactor(ageDays: number, halfLifeDays: number): number {
  return Math.pow(0.5, ageDays / halfLifeDays);
}

function eventTsMs(event: RecipeEngagementEvent): number {
  if (event.v2?.ts) return event.v2.ts;
  const parsed = Date.parse(event.at);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveCreatorId(
  event: RecipeEngagementEvent,
  refKeyToCreatorId: ReadonlyMap<string, string>,
): string | null {
  if (event.v2?.creatorId) return event.v2.creatorId;
  return refKeyToCreatorId.get(event.refKey) ?? null;
}

function visitHadCreatorOpen(
  creatorId: string,
  visitId: string,
  recipeEvents: readonly RecipeEngagementEvent[],
  surfaceEvents: readonly RecipesTabSurfaceEvent[],
  refKeyToCreatorId: ReadonlyMap<string, string>,
): boolean {
  if (
    surfaceEvents.some(
      (row) => row.type === 'creator_open' && row.visitId === visitId && row.creatorId === creatorId,
    )
  ) {
    return true;
  }
  return recipeEvents.some((row) => {
    if (row.type !== 'open') return false;
    const cid = resolveCreatorId(row, refKeyToCreatorId);
    return cid === creatorId && row.v2?.visitId === visitId;
  });
}

export interface CreatorEngagementTotals {
  positivePoints: number;
  misses: number;
  strongEvents: number;
  lifetimeImpressions: number;
}

export function aggregateCreatorEngagement(
  creatorId: string,
  recipeEvents: readonly RecipeEngagementEvent[],
  surfaceEvents: readonly RecipesTabSurfaceEvent[],
  refKeyToCreatorId: ReadonlyMap<string, string>,
  nowMs: number,
): CreatorEngagementTotals {
  let positivePoints = 0;
  let strongEvents = 0;
  let lifetimeImpressions = 0;
  let misses = 0;
  const tasteHalf = RECIPES_TAB_SURFACE.creatorTasteHalfLifeDays;
  const missHalf = RECIPES_TAB_SURFACE.creatorMissHalfLifeDays;

  for (const event of recipeEvents) {
    const cid = resolveCreatorId(event, refKeyToCreatorId);
    if (cid !== creatorId) continue;
    const type = event.type === 'cook' ? 'cook_confirmed' : event.type;
    const points = POSITIVE_POINTS[type];
    if (points == null) continue;
    const ageDays = (nowMs - eventTsMs(event)) / MS_PER_DAY;
    if (ageDays < 0) continue;
    positivePoints += points * decayFactor(ageDays, tasteHalf);
    if (STRONG_CREATOR_EVENTS.has(type)) strongEvents += 1;
  }

  for (const event of surfaceEvents) {
    if (event.type === 'creator_open' && event.creatorId === creatorId) {
      const ageDays = (nowMs - event.ts) / MS_PER_DAY;
      positivePoints += 1 * decayFactor(ageDays, tasteHalf);
    }
    if (event.type === 'creator_impression' && event.creatorId === creatorId) {
      lifetimeImpressions += 1;
      const ageDays = (nowMs - event.ts) / MS_PER_DAY;
      const opened = visitHadCreatorOpen(
        creatorId,
        event.visitId,
        recipeEvents,
        surfaceEvents,
        refKeyToCreatorId,
      );
      if (!opened) misses += decayFactor(ageDays, missHalf);
    }
  }

  return { positivePoints, misses, strongEvents, lifetimeImpressions };
}

export function creatorHasStrongEvent(totals: CreatorEngagementTotals): boolean {
  return totals.strongEvents >= 1;
}
