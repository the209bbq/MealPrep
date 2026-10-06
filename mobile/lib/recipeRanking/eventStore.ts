import { RECIPE_RANKING } from '../../config/recipeRanking';
import { readJson, writeJson } from '../storage';
import {
  applyEngagementEventToIndex,
  readEngagementIndex,
  rebuildEngagementIndex,
  writeEngagementIndex,
  type EngagementIndexV2,
} from './engagementIndex';
import { defaultTasteMetaForEvent } from './eventMeta';
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
  const maxEvents = RECIPE_RANKING.maxStoredEvents;
  const maxAgeMs = RECIPE_RANKING.maxStoredAgeDays * MS_PER_DAY;
  const now = Date.now();
  let trimmed = events;
  if (trimmed.length > maxEvents) {
    trimmed = trimmed.slice(trimmed.length - maxEvents);
  }
  trimmed = trimmed.filter((event) => {
    const ts = event.v2?.ts ?? Date.parse(event.at);
    return Number.isFinite(ts) && now - ts <= maxAgeMs;
  });
  return trimmed;
}

export function writeRecipeEngagementEvents(
  ownerId: string,
  events: RecipeEngagementEvent[],
): void {
  writeJson(storageKey(ownerId), trimEvents(events));
}

function ensureIndex(ownerId: string, events: RecipeEngagementEvent[]): EngagementIndexV2 {
  const existing = readEngagementIndex(ownerId);
  if (existing) return existing;
  const built = rebuildEngagementIndex(events, defaultTasteMetaForEvent);
  writeEngagementIndex(ownerId, built);
  return built;
}

export function readEngagementIndexForOwner(ownerId: string): EngagementIndexV2 {
  const events = readRecipeEngagementEvents(ownerId);
  return ensureIndex(ownerId, events);
}

export function appendRecipeEngagementEvent(
  ownerId: string,
  event: RecipeEngagementEvent,
  existing?: RecipeEngagementEvent[],
): RecipeEngagementEvent[] {
  const base = existing ?? readRecipeEngagementEvents(ownerId);
  const next = trimEvents([...base, event]);
  writeRecipeEngagementEvents(ownerId, next);

  const index = readEngagementIndex(ownerId) ?? rebuildEngagementIndex(base, defaultTasteMetaForEvent);
  applyEngagementEventToIndex(index, event, defaultTasteMetaForEvent(event.refKey, event));
  writeEngagementIndex(ownerId, index);
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
  type: Extract<
    RecipeEngagementEventType,
    | 'plan'
    | 'cook_now'
    | 'just_save'
    | 'skip'
    | 'import'
    | 'ghost_confirm'
    | 'ghost_override'
    | 'cook_confirmed'
    | 'cook_declined'
  >,
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
