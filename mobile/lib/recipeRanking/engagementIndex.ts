import { RECIPE_RANKING } from '../../config/recipeRanking';
import { readJson, writeJson } from '../storage';
import type { RecipeCategoryGroup, RecipeEngagementEvent, PlanSlotCode } from './types';
import {
  TASTE_HALF_LIFE_DAYS,
  tastePointsForEvent,
  isStrongPersonalEvent,
  normalizeV1EventType,
  type TasteEventMeta,
} from './v2Signals';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const GHOST_HALF_LIFE_DAYS = 45;
const STRONG_EVENT_WINDOW_DAYS = 90;

export type GhostOutcome = 'confirm' | 'override';

export interface EngagementIndexV2 {
  version: 2;
  tasteLastMs: number;
  tasteRecipe: Record<string, number>;
  tasteGroup: Record<string, number>;
  tasteArea: Record<string, number>;
  tasteTag: Record<string, number>;
  strongEventTimestamps: number[];
  impressionFatigue: Record<string, { sum: number; windowStartMs: number }>;
  cookDeclinedAt: Record<string, number[]>;
  cookConfirmedTotal: Record<string, number>;
  lastCookConfirmedMs: Record<string, number>;
  impressions14d: Record<string, { count: number; lastMs: number }>;
  openedAfterImpression: Record<string, boolean>;
  ghostSlot: Record<string, Partial<Record<PlanSlotCode, number>>>;
  ghostWeekday: Record<PlanSlotCode, Record<string, number>>;
  ghostOutcomes: Record<string, GhostOutcome[]>;
  compactPromptOn: Record<string, boolean>;
  ghostLastMs: number;
}

function emptyIndex(nowMs: number): EngagementIndexV2 {
  return {
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
  };
}

function indexStorageKey(ownerId: string): string {
  if (!ownerId || ownerId === 'guest') {
    return `${RECIPE_RANKING.guestEventsStorageKey}.indexV2`;
  }
  return `${RECIPE_RANKING.eventsStoragePrefix}.${ownerId}.indexV2`;
}

export function readEngagementIndex(ownerId: string): EngagementIndexV2 | null {
  const raw = readJson<EngagementIndexV2 | null>(indexStorageKey(ownerId), null);
  if (!raw || raw.version !== 2) return null;
  return raw;
}

export function writeEngagementIndex(ownerId: string, index: EngagementIndexV2): void {
  writeJson(indexStorageKey(ownerId), index);
}

function decayMaps(
  maps: Record<string, number>[],
  fromMs: number,
  toMs: number,
  halfLifeDays: number,
): void {
  if (toMs <= fromMs) return;
  const factor = Math.pow(0.5, (toMs - fromMs) / MS_PER_DAY / halfLifeDays);
  if (factor >= 0.999999) return;
  for (const map of maps) {
    for (const key of Object.keys(map)) {
      map[key] = (map[key] ?? 0) * factor;
    }
  }
}

function decayGhost(index: EngagementIndexV2, fromMs: number, toMs: number): void {
  if (toMs <= fromMs) return;
  const factor = Math.pow(0.5, (toMs - fromMs) / MS_PER_DAY / GHOST_HALF_LIFE_DAYS);
  if (factor >= 0.999999) return;
  for (const group of Object.keys(index.ghostSlot)) {
    const row = index.ghostSlot[group]!;
    for (const slot of ['B', 'L', 'D'] as PlanSlotCode[]) {
      if (row[slot] != null) row[slot] = (row[slot] ?? 0) * factor;
    }
  }
  for (const slot of ['B', 'L', 'D'] as PlanSlotCode[]) {
    const row = index.ghostWeekday[slot] ?? {};
    for (const day of Object.keys(row)) {
      row[day] = (row[day] ?? 0) * factor;
    }
    index.ghostWeekday[slot] = row;
  }
}

function eventTs(event: RecipeEngagementEvent): number {
  if (event.v2?.ts) return event.v2.ts;
  const parsed = Date.parse(event.at);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function bumpGhostSlot(index: EngagementIndexV2, group: RecipeCategoryGroup, slot: PlanSlotCode, delta: number): void {
  if (!index.ghostSlot[group]) index.ghostSlot[group] = {};
  const row = index.ghostSlot[group]!;
  row[slot] = Math.max(0, (row[slot] ?? 0) + delta);
}

function bumpGhostWeekday(index: EngagementIndexV2, slot: PlanSlotCode, weekday: number, delta: number): void {
  const key = String(weekday);
  const row = index.ghostWeekday[slot] ?? {};
  row[key] = Math.max(0, (row[key] ?? 0) + delta);
  index.ghostWeekday[slot] = row;
}

function weekdayFromIso(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function pushGhostOutcome(index: EngagementIndexV2, group: RecipeCategoryGroup, outcome: GhostOutcome): void {
  const key = group;
  const list = index.ghostOutcomes[key] ?? [];
  list.push(outcome);
  while (list.length > 10) list.shift();
  index.ghostOutcomes[key] = list;

  const confirms = list.filter((o) => o === 'confirm').length;
  const rate = list.length > 0 ? confirms / list.length : 0;
  if (list.length >= 5 && rate >= 0.8) {
    index.compactPromptOn[key] = true;
  } else if (list.length >= 5 && rate < 0.6) {
    index.compactPromptOn[key] = false;
  }
}

function addTastePoints(index: EngagementIndexV2, meta: TasteEventMeta, points: number): void {
  if (points === 0) return;
  index.tasteRecipe[meta.refKey] = (index.tasteRecipe[meta.refKey] ?? 0) + points;
  index.tasteGroup[meta.group] = (index.tasteGroup[meta.group] ?? 0) + points;
  index.tasteArea[meta.area] = (index.tasteArea[meta.area] ?? 0) + points;
  for (const tag of meta.tags) {
    const t = tag.toLowerCase().trim();
    if (!t) continue;
    index.tasteTag[t] = (index.tasteTag[t] ?? 0) + points;
  }
}

function trimStrongEvents(index: EngagementIndexV2, nowMs: number): void {
  const cutoff = nowMs - STRONG_EVENT_WINDOW_DAYS * MS_PER_DAY;
  index.strongEventTimestamps = index.strongEventTimestamps.filter((ts) => ts >= cutoff);
}

export function countStrongEvents(index: EngagementIndexV2, nowMs: number = Date.now()): number {
  trimStrongEvents(index, nowMs);
  return index.strongEventTimestamps.length;
}

export function applyEngagementEventToIndex(
  index: EngagementIndexV2,
  event: RecipeEngagementEvent,
  meta: TasteEventMeta,
): void {
  const ts = eventTs(event);
  decayMaps(
    [index.tasteRecipe, index.tasteGroup, index.tasteArea, index.tasteTag],
    index.tasteLastMs,
    ts,
    TASTE_HALF_LIFE_DAYS,
  );
  index.tasteLastMs = ts;
  decayGhost(index, index.ghostLastMs, ts);
  index.ghostLastMs = ts;
  trimStrongEvents(index, ts);

  const type = normalizeV1EventType(event.type);

  if (type === 'plan' && event.v2?.group && event.v2.day && event.v2.slot) {
    bumpGhostSlot(index, event.v2.group, event.v2.slot, 1);
    bumpGhostWeekday(index, event.v2.slot, weekdayFromIso(event.v2.day), 1);
  }

  if (type === 'ghost_confirm' && event.v2?.group) {
    pushGhostOutcome(index, event.v2.group, 'confirm');
    return;
  }

  if (type === 'ghost_override' && event.v2?.group) {
    const v2 = event.v2;
    pushGhostOutcome(index, v2.group, 'override');
    if (v2.suggestedSlot && v2.chosenSlot && v2.suggestedSlot !== v2.chosenSlot) {
      bumpGhostSlot(index, v2.group, v2.suggestedSlot, -0.5);
    }
    if (
      v2.suggestedDay &&
      v2.chosenDay &&
      v2.suggestedDay !== v2.chosenDay &&
      v2.suggestedSlot
    ) {
      bumpGhostWeekday(index, v2.suggestedSlot, weekdayFromIso(v2.suggestedDay), -0.5);
    }
    return;
  }

  if (type === 'impression') {
    index.openedAfterImpression[event.refKey] = false;
    const row = index.impressions14d[event.refKey] ?? { count: 0, lastMs: ts };
    if (ts - row.lastMs > 14 * MS_PER_DAY) row.count = 0;
    row.count += 1;
    row.lastMs = ts;
    index.impressions14d[event.refKey] = row;

    const fatigue = index.impressionFatigue[event.refKey] ?? { sum: 0, windowStartMs: ts };
    if (ts - fatigue.windowStartMs > 14 * MS_PER_DAY) {
      fatigue.sum = 0;
      fatigue.windowStartMs = ts;
    }
    fatigue.sum = Math.max(-1, fatigue.sum - 0.1);
    index.impressionFatigue[event.refKey] = fatigue;
    return;
  }

  if (type === 'open') {
    index.openedAfterImpression[event.refKey] = true;
    addTastePoints(index, meta, tastePointsForEvent('open'));
    return;
  }

  if (type === 'cook_declined') {
    const list = (index.cookDeclinedAt[event.refKey] ?? []).filter((t) => ts - t < 30 * MS_PER_DAY);
    const penalty = list.length >= 1 ? -3 : -1;
    addTastePoints(index, meta, penalty);
    index.cookDeclinedAt[event.refKey] = [...list, ts];
    return;
  }

  if (type === 'import') {
    const importMeta: TasteEventMeta = {
      ...meta,
      tags: event.v2?.tags ?? meta.tags,
    };
    addTastePoints(index, importMeta, tastePointsForEvent('import'));
    index.strongEventTimestamps.push(ts);
    return;
  }

  const points = tastePointsForEvent(type);
  if (points !== 0) {
    addTastePoints(index, meta, points);
  }

  if (isStrongPersonalEvent(type)) {
    index.strongEventTimestamps.push(ts);
  }

  if (type === 'cook_confirmed') {
    index.cookConfirmedTotal[event.refKey] = (index.cookConfirmedTotal[event.refKey] ?? 0) + 1;
    index.lastCookConfirmedMs[event.refKey] = ts;
  }

  const fatigue = index.impressionFatigue[event.refKey];
  if (fatigue && fatigue.sum < 0 && !index.openedAfterImpression[event.refKey]) {
    addTastePoints(index, meta, fatigue.sum);
    fatigue.sum = 0;
  }
}

export function rebuildEngagementIndex(
  events: readonly RecipeEngagementEvent[],
  metaForRef: (refKey: string, event: RecipeEngagementEvent) => TasteEventMeta,
): EngagementIndexV2 {
  const index = emptyIndex(events.length > 0 ? eventTs(events[events.length - 1]!) : Date.now());
  for (const event of events) {
    applyEngagementEventToIndex(index, event, metaForRef(event.refKey, event));
  }
  return index;
}

export function syncEngagementIndex(
  ownerId: string,
  events: readonly RecipeEngagementEvent[],
  metaForRef: (refKey: string, event: RecipeEngagementEvent) => TasteEventMeta,
): EngagementIndexV2 {
  const built = rebuildEngagementIndex(events, metaForRef);
  writeEngagementIndex(ownerId, built);
  return built;
}
