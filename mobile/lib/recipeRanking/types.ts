import type { RecipesTabFilterState } from '../../config/recipesTabFilters';
import type { UserDietPrefs } from '../diet/types';
import type { RecipeCostPricingContext } from '../costPerServing/types';
import type { RecipePantryMatch } from '../recipeMatch';
import type { Recipe } from '../../types/mealprep';

export type RecipeEngagementEventType =
  | 'impression'
  | 'open'
  | 'cook'
  | 'save'
  | 'like'
  | 'skip'
  | 'wont_cook';

export interface RecipeEngagementEvent {
  refKey: string;
  type: RecipeEngagementEventType;
  at: string;
}

export interface RecipeRankingInput {
  refKey: string;
  recipe: Recipe;
  match: RecipePantryMatch;
  ingredientLines: string[] | null;
}

export interface RecipeRankingContext {
  dietPrefs: UserDietPrefs;
  householdSize: number;
  tabFilters: RecipesTabFilterState;
  events: readonly RecipeEngagementEvent[];
  pricing: RecipeCostPricingContext;
  /** When false, personal and peer scores are forced to 0 (cold start). */
  personalSignalsReady: boolean;
}

export interface RecipeRankingBreakdown {
  refKey: string;
  total: number;
  fit: number;
  personal: number;
  peer: number;
  novelty: number;
  hardExcluded: boolean;
}
