import type { RecipeEngagementEventType } from './types';
import type { RecipeCategoryGroup } from '../seamlessFlow/categoryGroup';

export const TASTE_HALF_LIFE_DAYS = 30;
export const IMPRESSION_FATIGUE_HALF_LIFE_DAYS = 7;
export const PROFILE_BLEND_K = 3;

export interface TasteEventMeta {
  refKey: string;
  group: RecipeCategoryGroup;
  area: string;
  tags: string[];
}

const EVENT_POINTS: Partial<Record<RecipeEngagementEventType, number>> = {
  cook_confirmed: 5,
  plan: 3,
  import: 3,
  cook_now: 2,
  save: 2,
  just_save: 2,
  cook: 5,
  open: 0.5,
  skip: -0.5,
  cook_declined: -1,
  ghost_confirm: 0,
  ghost_override: 0,
  like: 0,
  wont_cook: 0,
  impression: 0,
};

export function tastePointsForEvent(type: RecipeEngagementEventType): number {
  return EVENT_POINTS[type] ?? 0;
}

export function isStrongPersonalEvent(type: RecipeEngagementEventType): boolean {
  return (
    type === 'cook_confirmed' ||
    type === 'cook' ||
    type === 'plan' ||
    type === 'save' ||
    type === 'just_save' ||
    type === 'import'
  );
}

export function normalizeV1EventType(type: RecipeEngagementEventType): RecipeEngagementEventType {
  if (type === 'cook') return 'cook_confirmed';
  if (type === 'just_save') return 'save';
  return type;
}
