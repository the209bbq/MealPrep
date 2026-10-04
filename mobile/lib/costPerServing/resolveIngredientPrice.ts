import { COMMUNITY_DEALS } from '../../config/communityDeals';
import { communityLineTotalForItem } from '../communityDeals/communityLineTotal';
import { fuzzyNameScore, normalizeIngredientName } from '../recipeMatch/normalize';
import { itemNameKey, readRememberedSizeUnit } from '../smartShop/addPriceMemory';
import type { CommunityStoreDeal } from '../communityDeals/types';
import type { ItemStoreDeal } from '../deals/types';
import type { GroceryListItem } from '../../types/mealprep';
import { proratedPackageCost } from './amountToPackage';
import { findBasePriceForIngredient } from './matchBasePrice';
import type { CostPriceSource } from './types';

function pseudoGroceryItem(name: string, quantity: number, unit: string): GroceryListItem {
  return {
    id: `cost-${itemNameKey(name)}`,
    ingredientId: `cost-ing-${itemNameKey(name)}`,
    name,
    category: 'dry_goods',
    quantity,
    unit,
    checked: false,
    sourceRecipeIds: [],
    origin: 'manual',
  };
}

function bestCommunityDeal(
  name: string,
  deals: CommunityStoreDeal[],
  ownerId: string,
): CommunityStoreDeal | null {
  let best: CommunityStoreDeal | null = null;
  let bestScore = 0;
  let bestOwn = false;
  const item = pseudoGroceryItem(name, 1, 'each');
  for (const deal of deals) {
    if (deal.isSample) continue;
    const score = fuzzyNameScore(item.name, deal.itemName);
    if (score < COMMUNITY_DEALS.fuzzyMatchMinScore) continue;
    const own = deal.reportedBy === ownerId;
    if (
      !best ||
      (own && !bestOwn) ||
      (own === bestOwn && score > bestScore) ||
      (own === bestOwn && score === bestScore && deal.price < best.price)
    ) {
      best = deal;
      bestScore = score;
      bestOwn = own;
    }
  }
  return best;
}

function costFromCommunityDeal(
  name: string,
  quantity: number,
  unit: string,
  deal: CommunityStoreDeal,
  ownerId: string,
): number | null {
  const remembered = readRememberedSizeUnit(ownerId, name);
  const item = pseudoGroceryItem(name, quantity, unit);
  if (deal.unit?.trim() || remembered) {
    return communityLineTotalForItem(deal, item);
  }
  const base = findBasePriceForIngredient(name);
  if (base) {
    return proratedPackageCost({
      quantity,
      unit,
      packageAmount: base.packageAmount,
      packageUnit: base.packageUnit,
      packagePrice: deal.price,
      baseEntry: base,
      rememberedSizeUnit: remembered,
    });
  }
  return deal.price;
}

function bestKrogerDeal(
  name: string,
  krogerByKey: Map<string, ItemStoreDeal> | undefined,
): ItemStoreDeal | null {
  if (!krogerByKey || krogerByKey.size === 0) return null;
  const key = normalizeIngredientName(name);
  const direct = krogerByKey.get(key);
  if (direct) return direct;
  let best: ItemStoreDeal | null = null;
  let bestScore = 0;
  for (const deal of krogerByKey.values()) {
    const score = fuzzyNameScore(name, deal.productTitle);
    if (score > bestScore) {
      bestScore = score;
      best = deal;
    }
  }
  return bestScore >= COMMUNITY_DEALS.fuzzyMatchMinScore ? best : null;
}

function costFromKrogerDeal(
  quantity: number,
  unit: string,
  deal: ItemStoreDeal,
  ownerId: string,
  ingredientName: string,
): number | null {
  const remembered = readRememberedSizeUnit(ownerId, ingredientName);
  const fraction = deal.quantity > 0 ? deal.lineTotal / deal.unitPrice : null;
  if (fraction != null && Number.isFinite(fraction) && deal.unitPrice > 0) {
    const perPackage = deal.unitPrice;
    const usedFraction =
      proratedPackageCost({
        quantity,
        unit,
        packageAmount: deal.quantity,
        packageUnit: deal.unit,
        packagePrice: perPackage,
        rememberedSizeUnit: remembered,
      }) ?? null;
    if (usedFraction != null) return usedFraction;
  }
  return proratedPackageCost({
    quantity,
    unit,
    packageAmount: 1,
    packageUnit: 'each',
    packagePrice: deal.lineTotal > 0 ? deal.lineTotal : deal.unitPrice,
    rememberedSizeUnit: remembered,
  });
}

export function resolveIngredientPrice(input: {
  name: string;
  quantity: number;
  unit: string;
  sizeScale?: number;
  ownerId: string;
  communityDeals: CommunityStoreDeal[];
  krogerDealsByIngredientKey?: Map<string, ItemStoreDeal>;
}): { cost: number; source: CostPriceSource } | null {
  const { name, quantity, unit, sizeScale = 1, ownerId, communityDeals, krogerDealsByIngredientKey } =
    input;
  const remembered = readRememberedSizeUnit(ownerId, name);

  const community = bestCommunityDeal(name, communityDeals, ownerId);
  if (community) {
    const cost = costFromCommunityDeal(name, quantity, unit, community, ownerId);
    if (cost != null && cost > 0) {
      return { cost, source: community.reportedBy === ownerId ? 'memory' : 'community' };
    }
  }

  const kroger = bestKrogerDeal(name, krogerDealsByIngredientKey);
  if (kroger) {
    const cost = costFromKrogerDeal(quantity, unit, kroger, ownerId, name);
    if (cost != null && cost > 0) {
      return { cost, source: 'kroger' };
    }
  }

  const base = findBasePriceForIngredient(name);
  if (base) {
    const cost = proratedPackageCost({
      quantity,
      unit,
      packageAmount: base.packageAmount,
      packageUnit: base.packageUnit,
      packagePrice: base.packagePrice,
      baseEntry: base,
      sizeScale,
      rememberedSizeUnit: remembered,
    });
    if (cost != null && cost > 0) {
      return { cost, source: 'base' };
    }
  }

  return null;
}
