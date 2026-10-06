import { RECIPE_RANKING } from '../../config/recipeRanking';
import type { RecipeEngagementEvent } from './types';
import { RECENCY_HALF_LIFE_DAYS, SIGNAL_WEIGHTS } from './weights';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function recencyMultiplier(ageMs: number, nowMs: number): number {
  const ageDays = Math.max(0, (nowMs - ageMs) / MS_PER_DAY);
  return Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
}

const V2_ONLY_EVENT_TYPES = new Set<RecipeEngagementEvent['type']>([
  'plan',
  'cook_now',
  'just_save',
]);

export function countCookSaveSignals(events: readonly RecipeEngagementEvent[]): number {
  return events.filter(
    (event) =>
      event.type === 'cook' ||
      event.type === 'save' ||
      event.type === 'just_save',
  ).length;
}

export function personalSignalsReady(events: readonly RecipeEngagementEvent[]): boolean {
  return countCookSaveSignals(events) >= RECIPE_RANKING.coldStartMinCookSaveEvents;
}

export function scorePersonalHistory(
  refKey: string,
  events: readonly RecipeEngagementEvent[],
  nowMs: number = Date.now(),
): number {
  let weighted = 0;
  for (const event of events) {
    if (event.refKey !== refKey) continue;
    if (event.type === 'impression' || event.type === 'wont_cook' || V2_ONLY_EVENT_TYPES.has(event.type)) {
      continue;
    }
    if (!(event.type in SIGNAL_WEIGHTS)) continue;
    const weight = SIGNAL_WEIGHTS[event.type as keyof typeof SIGNAL_WEIGHTS];
    const atMs = Date.parse(event.at);
    if (!Number.isFinite(atMs)) continue;
    weighted += weight * recencyMultiplier(atMs, nowMs);
  }
  const normalized = 50 + weighted * 28;
  return Math.max(0, Math.min(100, normalized));
}
