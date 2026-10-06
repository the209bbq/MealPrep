import { RECIPE_RANKING } from '../../config/recipeRanking';
import { readJson, writeJson } from '../storage';
import type {
  RecipeEngagementEvent,
  RecipeEngagementEventType,
  RecipeEngagementEventV2,
} from './types';

function storageKey(ownerId: string): string {
  if (!ownerId || ownerId === 'guest') {
    return RECIPE_RANKING.guestEventsStorageKey;
  }
  return `${RECIPE_RANKING.eventsStoragePrefix}.${ownerId}`;
}

export function readRecipeEngagementEvents(ownerId: string): RecipeEngagementEvent[] {
  const raw = readJson<RecipeEngagementEvent[]>(storageKey(ownerId), []);
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (row) =>
      row &&
      typeof row.refKey === 'string' &&
      typeof row.type === 'string' &&
      typeof row.at === 'string',
  );
}

function trimEvents(events: RecipeEngagementEvent[]): RecipeEngagementEvent[] {
  if (events.length <= RECIPE_RANKING.maxStoredEvents) return events;
  return events.slice(events.length - RECIPE_RANKING.maxStoredEvents);
}

export function writeRecipeEngagementEvents(
  ownerId: string,
  events: RecipeEngagementEvent[],
): void {
  writeJson(storageKey(ownerId), trimEvents(events));
}

export function appendRecipeEngagementEvent(
  ownerId: string,
  event: RecipeEngagementEvent,
  existing?: RecipeEngagementEvent[],
): RecipeEngagementEvent[] {
  const base = existing ?? readRecipeEngagementEvents(ownerId);
  const next = [...base, event];
  writeRecipeEngagementEvents(ownerId, next);
  return next;
}

export function shouldLogImpression(
  refKey: string,
  events: readonly RecipeEngagementEvent[],
  nowMs: number = Date.now(),
): boolean {
  const windowStart = nowMs - RECIPE_RANKING.impressionDedupeMs;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]!;
    if (event.refKey !== refKey || event.type !== 'impression') continue;
    const atMs = Date.parse(event.at);
    if (Number.isFinite(atMs) && atMs >= windowStart) {
      return false;
    }
    break;
  }
  return true;
}

export function createEngagementEvent(
  refKey: string,
  type: RecipeEngagementEventType,
  at: string = new Date().toISOString(),
): RecipeEngagementEvent {
  return { refKey, type, at };
}

export function createSeamlessEngagementEvent(
  refKey: string,
  type: Extract<RecipeEngagementEventType, 'plan' | 'cook_now' | 'just_save' | 'skip'>,
  v2: RecipeEngagementEventV2,
): RecipeEngagementEvent {
  const ts = v2.ts ?? Date.now();
  return {
    refKey,
    type,
    at: new Date(ts).toISOString(),
    v2: { ...v2, ts },
  };
}

export function clearWontCookForRef(
  ownerId: string,
  refKey: string,
  existing?: RecipeEngagementEvent[],
): RecipeEngagementEvent[] {
  const base = existing ?? readRecipeEngagementEvents(ownerId);
  const next = base.filter((event) => !(event.refKey === refKey && event.type === 'wont_cook'));
  writeRecipeEngagementEvents(ownerId, next);
  return next;
}
