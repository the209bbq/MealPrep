import { RECIPES_TAB_SURFACE } from '../../config/recipesTabSurface';

export interface RecipesTabSectionExpanded {
  classic: boolean;
  creators: boolean;
}

/** In-memory default for Home catalog sections (both collapsed on fresh mount). */
export function defaultRecipesTabSectionExpanded(): RecipesTabSectionExpanded {
  return {
    classic: RECIPES_TAB_SURFACE.defaultClassicExpanded,
    creators: RECIPES_TAB_SURFACE.defaultCreatorsExpanded,
  };
}
