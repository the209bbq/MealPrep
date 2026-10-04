import type { RecipeIngredient } from '../../types/mealprep';

export type CostPriceSource = 'community' | 'kroger' | 'base' | 'memory';

export interface IngredientCostLine {
  ingredient: RecipeIngredient;
  cost: number | null;
  source?: CostPriceSource;
  skippedReason?: 'unpriceable' | 'unmatched';
}

export interface RecipeCostEstimate {
  totalCost: number;
  costPerServing: number | null;
  servings: number;
  servingsAssumedDefault: boolean;
  pricedCount: number;
  unpricedCount: number;
  lines: IngredientCostLine[];
}

export interface BasePriceEntry {
  id: string;
  /** Canonical product name for display. */
  name: string;
  aliases: string[];
  packageAmount: number;
  packageUnit: string;
  /** Typical retail price for the package (USD). */
  packagePrice: number;
  /** Grams per US cup when converting volume measures (optional). */
  gramsPerCup?: number;
  /** Typical grams per count item (onion, egg, etc.). */
  gramsEach?: number;
}

export interface RecipeCostPricingContext {
  ownerId: string;
  communityDeals: import('../communityDeals/types').CommunityStoreDeal[];
  /** Kroger / comparison deals keyed by normalized ingredient phrase (optional cache). */
  krogerDealsByIngredientKey?: Map<string, import('../deals/types').ItemStoreDeal>;
}
