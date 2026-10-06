import { RECIPE_RANKING } from '../../config/recipeRanking';
import type { UserDietPrefs } from '../diet/types';
import type { EngagementIndexV2 } from './engagementIndex';
import { countStrongEvents } from './engagementIndex';
import { profilePriorScore } from './profilePrior';
import type { RecipeRankingInput } from './types';
import { recipeFeaturesFromRankingInput } from './recipeFeatures';
import { PROFILE_BLEND_K } from './v2Signals';

function squash(sum: number): number {
  return Math.tanh(sum / 8);
}

function learnedAffinityFromIndex(
  index: EngagementIndexV2,
  input: RecipeRankingInput,
): number {
  const features = input.group
    ? { group: input.group, area: input.area ?? 'unknown', tags: input.tags ?? [] }
    : recipeFeaturesFromRankingInput(input);
  const recipeSum = index.tasteRecipe[input.refKey] ?? 0;
  const groupSum = index.tasteGroup[features.group] ?? 0;
  const areaSum = index.tasteArea[features.area] ?? 0;
  const tagSums = features.tags.map((t) => index.tasteTag[t.toLowerCase()] ?? 0);
  const tagMean = tagSums.length > 0 ? tagSums.reduce((a, b) => a + b, 0) / tagSums.length : 0;

  const learned =
    0.4 * squash(recipeSum) +
    0.3 * squash(groupSum) +
    0.2 * squash(areaSum) +
    0.1 * squash(tagMean);
  return (learned + 1) / 2;
}

export function countCookSaveSignals(events: readonly { type: string }[]): number {
  return events.filter(
    (event) =>
      event.type === 'cook' ||
      event.type === 'cook_confirmed' ||
      event.type === 'save' ||
      event.type === 'just_save' ||
      event.type === 'plan' ||
      event.type === 'import',
  ).length;
}

/** @deprecated v2 always blends profile prior; returns true when any engagement exists. */
export function personalSignalsReady(events: readonly { type: string }[]): boolean {
  return countCookSaveSignals(events) >= RECIPE_RANKING.coldStartMinCookSaveEvents;
}

export function scorePersonalV2(
  input: RecipeRankingInput,
  index: EngagementIndexV2,
  dietPrefs: UserDietPrefs,
  householdSize: number,
  nowMs: number = Date.now(),
): number {
  const features = input.group
    ? { group: input.group, area: input.area ?? 'unknown', tags: input.tags ?? [] }
    : recipeFeaturesFromRankingInput(input);
  const n = countStrongEvents(index, nowMs);
  const learned01 = learnedAffinityFromIndex(index, input);
  const prior01 = profilePriorScore(dietPrefs, features.group, input.recipe, householdSize) / 100;
  const blended01 = (n * learned01 + PROFILE_BLEND_K * prior01) / (n + PROFILE_BLEND_K);
  return Math.max(0, Math.min(100, blended01 * 100));
}

/** @deprecated Use scorePersonalV2 with engagement index. */
export function scorePersonalHistory(
  refKey: string,
  events: readonly { refKey: string; type: string; at: string }[],
  nowMs: number = Date.now(),
): number {
  let weighted = 0;
  for (const event of events) {
    if (event.refKey !== refKey) continue;
    if (event.type === 'cook' || event.type === 'cook_confirmed') weighted += 5;
    else if (event.type === 'save' || event.type === 'just_save') weighted += 2;
    else if (event.type === 'open') weighted += 0.5;
    const atMs = Date.parse(event.at);
    if (!Number.isFinite(atMs)) continue;
    const ageDays = Math.max(0, (nowMs - atMs) / (24 * 60 * 60 * 1000));
    weighted *= Math.pow(0.5, ageDays / 30);
  }
  const normalized = 50 + weighted * 5;
  return Math.max(0, Math.min(100, normalized));
}
