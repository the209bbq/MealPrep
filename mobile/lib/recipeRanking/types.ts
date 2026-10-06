import type { RecipesTabFilterState } from '../../config/recipesTabFilters';
import type { UserDietPrefs } from '../diet/types';
import type { RecipeCostPricingContext } from '../costPerServing/types';
import type { RecipePantryMatch } from '../recipeMatch';
import type { Recipe } from '../../types/mealprep';
import type { EngagementIndexV2 } from './engagementIndex';

export type RecipeEngagementEventType =
  | 'impression'
  | 'open'
  | 'cook'
  | 'cook_confirmed'
  | 'cook_declined'
  | 'save'
  | 'like'
  | 'skip'
  | 'wont_cook'
  | 'plan'
  | 'cook_now'
  | 'just_save'
  | 'import'
  | 'ghost_confirm'
  | 'ghost_override';

export type RecipeEngagementSource = 'mealdb' | 'creator' | 'import';

export type RecipeCategoryGroup = 'breakfast' | 'light' | 'dessert' | 'main' | 'unknown';

export type PlanSlotCode = 'B' | 'L' | 'D';

/** Extra fields for seamless-flow events (personalization v2). */
export interface RecipeEngagementEventV2 {
  ts: number;
  recipeId: string;
  source: RecipeEngagementSource;
  group: RecipeCategoryGroup;
  sheetId: string;
  creatorId?: string;
  visitId?: string;
  day?: string;
  slot?: PlanSlotCode;
  ghostShown?: boolean;
  missingCount?: number;
  tags?: string[];
  suggestedDay?: string;
  suggestedSlot?: PlanSlotCode;
  chosenDay?: string;
  chosenSlot?: PlanSlotCode;
  via?: 'planned' | 'cook_now';
}

export interface RecipeEngagementEvent {
  refKey: string;
  type: RecipeEngagementEventType;
  at: string;
  v2?: RecipeEngagementEventV2;
}

export interface RecipeRankingInput {
  refKey: string;
  recipe: Recipe;
  match: RecipePantryMatch;
  ingredientLines: string[] | null;
  /** Category group for personal scoring (optional; derived when missing). */
  group?: RecipeCategoryGroup;
  area?: string;
  tags?: string[];
}

export interface RecipeRankingContext {
  dietPrefs: UserDietPrefs;
  householdSize: number;
  tabFilters: RecipesTabFilterState;
  events: readonly RecipeEngagementEvent[];
  pricing: RecipeCostPricingContext;
  engagementIndex: EngagementIndexV2;
  /** @deprecated v2 uses smooth blend; kept for callers, ignored by scorer. */
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
  repetitionAdjust?: number;
  reason?: string;
}
