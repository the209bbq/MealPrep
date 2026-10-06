import type { RecipeCategoryGroup, RecipeEngagementEvent } from './types';
import type { TasteEventMeta } from './v2Signals';

export function defaultTasteMetaForEvent(refKey: string, event: RecipeEngagementEvent): TasteEventMeta {
  const v2 = event.v2;
  return {
    refKey,
    group: v2?.group ?? 'unknown',
    area: 'unknown',
    tags: v2?.tags ?? [],
  };
}
