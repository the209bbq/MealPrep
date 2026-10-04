import { COMMUNITY_DEALS } from '../../config/communityDeals';
import { fuzzyNameScore } from '../recipeMatch/normalize';
import { isRealPriceDeal } from '../smartShop/realPricing';
import { readRememberedSizeUnit } from '../smartShop/addPriceMemory';
import type { CommunityStoreDeal } from '../communityDeals/types';
import type { ItemStoreDeal } from '../deals/types';
import { matchBasePriceEntry } from './matchBasePrice';
import { packageSizeFromDealUnit, proratedPackageCost } from './prorate';
import type { RecipeCostPriceSource } from './types';

export interface ResolvedIngredientPrice {
  cost: number;
  source: RecipeCostPriceSource;
}

function bestCommunityDeal(
  ingredientName: string,
  deals: CommunityStoreDeal[],
  ownerId: string,
): CommunityStoreDeal | null {
  const scored: { deal: CommunityStoreDeal; score: number }[] = [];
  for (const deal of deals) {
    if (deal.isSample) continue;
    const score = fuzzyNameScore(ingredientName, deal.itemName);
    if (score >= COMMUNITY_DEALS.fuzzyMatchMinScore) {
      scored.push({ deal, score });
    }
  }
  if (scored.length === 0) return null;

  const own = scored.filter((s) => s.deal.reportedBy === ownerId);
  const pool = own.length > 0 ? own : scored;
  pool.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.deal.price - b.deal.price;
  });
  return pool[0]?.deal ?? null;
}

function bestKrogerDeal(ingredientName: string, deals: ItemStoreDeal[]): ItemStoreDeal | null {
  let best: ItemStoreDeal | null = null;
  let bestScore = 0;
  for (const deal of deals) {
    if (!isRealPriceDeal(deal) || deal.priceSource !== 'kroger') continue;
    const score = fuzzyNameScore(ingredientName, deal.productTitle);
    if (score >= COMMUNITY_DEALS.fuzzyMatchMinScore && score > bestScore) {
      bestScore = score;
      best = deal;
    } else if (
      best &&
      score >= COMMUNITY_DEALS.fuzzyMatchMinScore &&
      score === bestScore &&
      deal.unitPrice < best.unitPrice
    ) {
      best = deal;
    }
  }
  return best;
}

function costFromCommunityDeal(
  deal: CommunityStoreDeal,
  quantity: number,
  unit: string,
  ownerId: string,
  ingredientName: string,
): number | null {
  const remembered = readRememberedSizeUnit(ownerId, ingredientName);
  const packageSize =
    packageSizeFromDealUnit(remembered ?? deal.unit, deal.itemName) ??
    packageSizeFromDealUnit(deal.unit, deal.itemName);
  if (!packageSize) return null;
  return proratedPackageCost(quantity, unit, packageSize, deal.price);
}

function costFromKrogerDeal(deal: ItemStoreDeal, quantity: number, unit: string): number | null {
  const packageSize = packageSizeFromDealUnit(`${deal.quantity} ${deal.unit}`, deal.productTitle);
  if (!packageSize) return null;
  return proratedPackageCost(quantity, unit, packageSize, deal.unitPrice);
}

export function resolveIngredientPrice(input: {
  ingredientName: string;
  quantity: number;
  unit: string;
  ownerId: string;
  communityDeals?: CommunityStoreDeal[];
  krogerDeals?: ItemStoreDeal[];
}): ResolvedIngredientPrice | null {
  const { ingredientName, quantity, unit, ownerId } = input;
  const community = input.communityDeals ?? [];
  const kroger = input.krogerDeals ?? [];

  const ownMatches = community.filter(
    (d) =>
      !d.isSample &&
      d.reportedBy === ownerId &&
      fuzzyNameScore(ingredientName, d.itemName) >= COMMUNITY_DEALS.fuzzyMatchMinScore,
  );
  if (ownMatches.length > 0) {
    ownMatches.sort((a, b) => a.price - b.price);
    for (const deal of ownMatches) {
      const cost = costFromCommunityDeal(deal, quantity, unit, ownerId, ingredientName);
      if (cost !== null) return { cost, source: 'user' };
    }
  }

  const communityDeal = bestCommunityDeal(ingredientName, community, ownerId);
  if (communityDeal && !ownMatches.includes(communityDeal)) {
    const cost = costFromCommunityDeal(communityDeal, quantity, unit, ownerId, ingredientName);
    if (cost !== null) return { cost, source: 'community' };
  }

  const krogerDeal = bestKrogerDeal(ingredientName, kroger);
  if (krogerDeal) {
    const cost = costFromKrogerDeal(krogerDeal, quantity, unit);
    if (cost !== null) return { cost, source: 'kroger' };
  }

  const base = matchBasePriceEntry(ingredientName);
  if (base) {
    const cost = proratedPackageCost(
      quantity,
      unit,
      { amount: base.packageAmount, unit: base.packageUnit },
      base.packagePrice,
      base.key,
    );
    if (cost !== null) return { cost, source: 'baseline' };
  }

  return null;
}
