import type { GroceryListItem } from '../../types/mealprep';
import { resolveStoreChainKey } from '../../config/weeklyAds';
import type { CommunityStoreDeal } from './types';
import type { DealsSearchResult, ItemStoreDeal, StoreLocation } from '../deals/types';
import { assembleDealsResult } from '../deals/buildShopResult';
import { communityDealsForGroceryList } from './filterDeals';
import { matchCommunityDealToGroceryItem } from './matchItem';
import { COMMUNITY_DEALS } from '../../config/communityDeals';
import { communityLineTotalForItem } from './communityLineTotal';

function communityDealToItemStoreDeal(
  deal: CommunityStoreDeal,
  item: GroceryListItem,
  storeId: string,
): ItemStoreDeal {
  const unitPrice = Math.round(deal.price * 100) / 100;
  return {
    groceryItemId: item.id,
    storeId,
    productTitle: deal.itemName,
    unitPrice,
    lineTotal: communityLineTotalForItem(deal, item),
    quantity: item.quantity,
    unit: deal.unit ?? item.unit,
    promoLabel: deal.priceKind === 'sale' ? 'Sale' : undefined,
    priceSource: 'community',
    communityDealId: deal.id,
    communityReportedAt: deal.createdAt,
  };
}

function pickCheaperDeal(a: ItemStoreDeal, b: ItemStoreDeal): ItemStoreDeal {
  if (a.lineTotal < b.lineTotal - 0.001) return a;
  if (b.lineTotal < a.lineTotal - 0.001) return b;
  const rank = (d: ItemStoreDeal) => (d.priceSource === 'community' ? 1 : 0);
  return rank(a) <= rank(b) ? a : b;
}

export function mergeCommunityDealsIntoSearchResult(
  result: DealsSearchResult,
  communityDeals: CommunityStoreDeal[],
  items: GroceryListItem[],
): DealsSearchResult {
  if (communityDeals.length === 0 || items.length === 0) return result;

  const eligibleDeals = communityDealsForGroceryList(communityDeals, items);
  if (eligibleDeals.length === 0) return result;

  const dealsByStoreKey = new Map<string, CommunityStoreDeal[]>();
  for (const deal of eligibleDeals) {
    const list = dealsByStoreKey.get(deal.storeKey) ?? [];
    list.push(deal);
    dealsByStoreKey.set(deal.storeKey, list);
  }

  const dealMap = new Map<string, ItemStoreDeal>();
  for (const existing of result.deals) {
    dealMap.set(`${existing.groceryItemId}:${existing.storeId}`, existing);
  }

  for (const store of result.stores) {
    const storeKey = resolveStoreChainKey(store);
    if (!storeKey) continue;
    const storeDeals = dealsByStoreKey.get(storeKey);
    if (!storeDeals?.length) continue;

    for (const item of items) {
      let bestCommunity: CommunityStoreDeal | null = null;
      let bestScore = 0;
      for (const deal of storeDeals) {
        const score = matchCommunityDealToGroceryItem(item, deal);
        if (score >= COMMUNITY_DEALS.fuzzyMatchMinScore && score > bestScore) {
          bestScore = score;
          bestCommunity = deal;
        } else if (
          bestCommunity &&
          score >= COMMUNITY_DEALS.fuzzyMatchMinScore &&
          score === bestScore &&
          deal.price < bestCommunity.price
        ) {
          bestCommunity = deal;
        }
      }
      if (!bestCommunity) continue;

      const key = `${item.id}:${store.id}`;
      const community = communityDealToItemStoreDeal(bestCommunity, item, store.id);
      const existing = dealMap.get(key);
      dealMap.set(key, existing ? pickCheaperDeal(existing, community) : community);
    }
  }

  const mergedDeals = [...dealMap.values()];
  const hasCommunity = mergedDeals.some((d) => d.priceSource === 'community');
  const pricingNote = hasCommunity
    ? [result.pricingNote, 'Includes shopper-reported prices (not verified by the store).']
        .filter(Boolean)
        .join(' ')
    : result.pricingNote;

  return assembleDealsResult({
    mode: result.mode,
    providerId: result.providerId,
    providerLabel: result.providerLabel,
    pricingNote,
    stores: result.stores,
    deals: mergedDeals,
    items,
  });
}

export function storeHasCommunityPricing(
  store: StoreLocation,
  communityDeals: CommunityStoreDeal[],
): boolean {
  const key = resolveStoreChainKey(store);
  if (!key) return false;
  return communityDeals.some((d) => d.storeKey === key);
}
