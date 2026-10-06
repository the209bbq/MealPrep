import { RECIPES_TAB_SURFACE } from '../../config/recipesTabSurface';
import { readJson, writeJson } from '../storage';

export type CreatorSlotType = 'favorite' | 'sample' | 'explore';

export type RecipesTabSurfaceEventType =
  | 'creator_impression'
  | 'creator_open'
  | 'category_impression'
  | 'category_open';

export interface RecipesTabSurfaceEventBase {
  type: RecipesTabSurfaceEventType;
  ts: number;
  visitId: string;
}

export interface CreatorSurfaceEvent extends RecipesTabSurfaceEventBase {
  type: 'creator_impression' | 'creator_open';
  creatorId: string;
  position: number;
  slotType: CreatorSlotType;
}

export interface CategorySurfaceEvent extends RecipesTabSurfaceEventBase {
  type: 'category_impression' | 'category_open';
  category: string;
  position: number;
}

export type RecipesTabSurfaceEvent = CreatorSurfaceEvent | CategorySurfaceEvent;

function storageKey(ownerId: string): string {
  if (!ownerId || ownerId === 'guest') {
    return `${RECIPES_TAB_SURFACE.surfaceEventsStoragePrefix}.guest`;
  }
  return `${RECIPES_TAB_SURFACE.surfaceEventsStoragePrefix}.${ownerId}`;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_EVENTS = 2000;
const MAX_AGE_MS = 180 * MS_PER_DAY;

export function readRecipesTabSurfaceEvents(ownerId: string): RecipesTabSurfaceEvent[] {
  const raw = readJson<RecipesTabSurfaceEvent[]>(storageKey(ownerId), []);
  if (!Array.isArray(raw)) return [];
  const now = Date.now();
  return raw.filter(
    (row) =>
      row &&
      typeof row.ts === 'number' &&
      typeof row.visitId === 'string' &&
      typeof row.type === 'string' &&
      now - row.ts <= MAX_AGE_MS,
  );
}

function trimEvents(events: RecipesTabSurfaceEvent[]): RecipesTabSurfaceEvent[] {
  let trimmed = events;
  if (trimmed.length > MAX_EVENTS) {
    trimmed = trimmed.slice(trimmed.length - MAX_EVENTS);
  }
  const now = Date.now();
  return trimmed.filter((event) => now - event.ts <= MAX_AGE_MS);
}

export function appendRecipesTabSurfaceEvent(
  ownerId: string,
  event: RecipesTabSurfaceEvent,
  existing?: RecipesTabSurfaceEvent[],
): RecipesTabSurfaceEvent[] {
  const base = existing ?? readRecipesTabSurfaceEvents(ownerId);
  const next = trimEvents([...base, event]);
  writeJson(storageKey(ownerId), next);
  return next;
}

export function countCreatorLifetimeImpressions(
  events: readonly RecipesTabSurfaceEvent[],
  creatorId: string,
): number {
  return events.filter(
    (event) => event.type === 'creator_impression' && event.creatorId === creatorId,
  ).length;
}

export function categoryImpressionsInWindow(
  events: readonly RecipesTabSurfaceEvent[],
  category: string,
  windowDays: number,
  nowMs: number,
): number {
  const windowStart = nowMs - windowDays * MS_PER_DAY;
  return events.filter(
    (event) =>
      event.type === 'category_impression' &&
      event.category === category &&
      event.ts >= windowStart,
  ).length;
}

export function categoryWasOpenedInVisit(
  events: readonly RecipesTabSurfaceEvent[],
  visitId: string,
  category: string,
): boolean {
  return events.some(
    (event) =>
      event.type === 'category_open' && event.visitId === visitId && event.category === category,
  );
}
