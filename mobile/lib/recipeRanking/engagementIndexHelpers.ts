import type { EngagementIndexV2 } from './engagementIndex';

export function emptyEngagementIndexForGhost(now: Date = new Date()): EngagementIndexV2 {
  const nowMs = now.getTime();
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
