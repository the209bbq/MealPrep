import type { CommunityStoreDeal } from '../communityDeals/types';
import type { ItemStoreDeal } from '../deals/types';

export type RecipeCostPriceSource = 'user' | 'community' | 'kroger' | 'baseline';

export interface RecipeCostLine {
  ingredientId: string;
  name: string;
  cost: number | null;
  skipped: boolean;
  skipReason?: 'unpriceable' | 'unmatched' | 'no_amount';
  priceSource?: RecipeCostPriceSource;
}

export interface RecipeCostResult {
  costPerServing: number | null;
  totalCost: number;
  servings: number;
  usedDefaultServings: boolean;
  pricedCount: number;
  skippedCount: number;
  lines: RecipeCostLine[];
}

export interface RecipeCostContext {
  ownerId: string;
  communityDeals?: CommunityStoreDeal[];
  krogerDeals?: ItemStoreDeal[];
}

export interface BasePriceEntry {
  key: string;
  aliases: string[];
  packageAmount: number;
  packageUnit: string;
  packagePrice: number;
}
