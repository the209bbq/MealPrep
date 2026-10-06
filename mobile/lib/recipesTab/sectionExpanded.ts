import { RECIPES_TAB_SURFACE } from '../../config/recipesTabSurface';
import { readJson, writeJson } from '../storage';

export interface RecipesTabSectionExpanded {
  classic: boolean;
  creators: boolean;
}

function storageKey(ownerId: string): string {
  return `${RECIPES_TAB_SURFACE.sectionExpandedStorageKey}.${ownerId || 'guest'}`;
}

export function readRecipesTabSectionExpanded(ownerId: string): RecipesTabSectionExpanded {
  const raw = readJson<Partial<RecipesTabSectionExpanded> | null>(storageKey(ownerId), null);
  return {
    classic: raw?.classic ?? RECIPES_TAB_SURFACE.defaultClassicExpanded,
    creators: raw?.creators ?? RECIPES_TAB_SURFACE.defaultCreatorsExpanded,
  };
}

export function writeRecipesTabSectionExpanded(
  ownerId: string,
  value: RecipesTabSectionExpanded,
): void {
  writeJson(storageKey(ownerId), value);
}
