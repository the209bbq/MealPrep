import { RECIPES_TAB_SURFACE } from '../../config/recipesTabSurface';
import { readJson, writeJson } from '../storage';

export interface RecipesTabVisitState {
  lastVisitAt: number;
  lastVisitId: string;
  /** Visit id immediately before the current one (for category fatigue). */
  priorVisitId?: string;
  lastFirst5Creators: string[];
  lastFirst3Categories: string[];
  /** Creator ids in first 5 for each of the last 3 visits (for fatigue). */
  recentFirst5Visits: string[][];
}

export interface RecipesTabVisitSession {
  visitId: string;
  isNewVisit: boolean;
  state: RecipesTabVisitState;
}

function emptyState(nowMs: number): RecipesTabVisitState {
  return {
    lastVisitAt: nowMs,
    lastVisitId: `visit-${nowMs}`,
    lastFirst5Creators: [],
    lastFirst3Categories: [],
    recentFirst5Visits: [],
  };
}

export function readRecipesTabVisitState(ownerId: string): RecipesTabVisitState | null {
  const raw = readJson<RecipesTabVisitState | null>(
    `${RECIPES_TAB_SURFACE.visitStateStorageKey}.${ownerId || 'guest'}`,
    null,
  );
  if (!raw || typeof raw.lastVisitAt !== 'number') return null;
  return {
    lastVisitAt: raw.lastVisitAt,
    lastVisitId: raw.lastVisitId ?? '',
    lastFirst5Creators: raw.lastFirst5Creators ?? [],
    lastFirst3Categories: raw.lastFirst3Categories ?? [],
    recentFirst5Visits: raw.recentFirst5Visits ?? [],
  };
}

export function writeRecipesTabVisitState(ownerId: string, state: RecipesTabVisitState): void {
  writeJson(`${RECIPES_TAB_SURFACE.visitStateStorageKey}.${ownerId || 'guest'}`, state);
}

export function resolveRecipesTabVisit(
  ownerId: string,
  nowMs: number,
  options?: { coldStart?: boolean },
): RecipesTabVisitSession {
  const prior = readRecipesTabVisitState(ownerId);
  const coldStart = options?.coldStart ?? false;
  const isNewVisit =
    coldStart ||
    !prior ||
    nowMs - prior.lastVisitAt >= RECIPES_TAB_SURFACE.visitGapMs;

  if (!isNewVisit && prior) {
    return { visitId: prior.lastVisitId, isNewVisit: false, state: prior };
  }

  const visitId = `visit-${nowMs}-${Math.random().toString(36).slice(2, 8)}`;
  const state: RecipesTabVisitState = prior
    ? {
        ...prior,
        lastVisitAt: nowMs,
        lastVisitId: visitId,
        priorVisitId: prior.lastVisitId,
      }
    : emptyState(nowMs);

  state.lastVisitId = visitId;
  state.lastVisitAt = nowMs;
  writeRecipesTabVisitState(ownerId, state);
  return { visitId, isNewVisit: true, state };
}

export function commitVisitRowOrder(
  ownerId: string,
  state: RecipesTabVisitState,
  first5Creators: readonly string[],
  first3Categories: readonly string[],
): RecipesTabVisitState {
  const next: RecipesTabVisitState = {
    ...state,
    lastFirst5Creators: [...first5Creators],
    lastFirst3Categories: [...first3Categories],
    recentFirst5Visits: [
      [...first5Creators],
      ...(state.recentFirst5Visits ?? []).slice(0, 2),
    ],
  };
  writeRecipesTabVisitState(ownerId, next);
  return next;
}

/** In-memory visit session for tests (no storage). */
export function resolveVisitForSimulation(
  prior: RecipesTabVisitState | null,
  nowMs: number,
  coldStart = false,
): RecipesTabVisitSession {
  const isNewVisit =
    coldStart || !prior || nowMs - prior.lastVisitAt >= RECIPES_TAB_SURFACE.visitGapMs;
  if (!isNewVisit && prior) {
    return { visitId: prior.lastVisitId, isNewVisit: false, state: prior };
  }
  const visitId = `sim-${nowMs}`;
  const state: RecipesTabVisitState = prior
    ? { ...prior, lastVisitAt: nowMs, lastVisitId: visitId, priorVisitId: prior.lastVisitId }
    : emptyState(nowMs);
  state.lastVisitId = visitId;
  state.lastVisitAt = nowMs;
  return { visitId, isNewVisit: true, state };
}
