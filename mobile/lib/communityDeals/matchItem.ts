import { COMMUNITY_DEALS } from '../../config/communityDeals';
import { fuzzyNameScore } from '../recipeMatch/normalize';
import type { GroceryListItem } from '../../types/mealprep';
import type { CommunityStoreDeal } from './types';

export interface GroceryCommunityDealBadge {
  groceryItemId: string;
  deal: CommunityStoreDeal;
  storeLabel: string;
  score: number;
}

export function matchCommunityDealToGroceryItem(
  item: GroceryListItem,
  deal: CommunityStoreDeal,
): number {
  return fuzzyNameScore(item.name, deal.itemName);
}

export function findBestCommunityDealForItem(
  item: GroceryListItem,
  deals: CommunityStoreDeal[],
  storeLabelByKey: Map<string, string>,
): GroceryCommunityDealBadge | null {
  let best: GroceryCommunityDealBadge | null = null;
  for (const deal of deals) {
    const score = matchCommunityDealToGroceryItem(item, deal);
    if (score < COMMUNITY_DEALS.fuzzyMatchMinScore) continue;
    const storeLabel = storeLabelByKey.get(deal.storeKey) ?? deal.storeName ?? deal.storeKey;
    if (!best || score > best.score || (score === best.score && deal.price < best.deal.price)) {
      best = { groceryItemId: item.id, deal, storeLabel, score };
    }
  }
  return best;
}

export function buildGroceryCommunityBadges(
  items: GroceryListItem[],
  deals: CommunityStoreDeal[],
  storeLabelByKey: Map<string, string>,
): Map<string, GroceryCommunityDealBadge> {
  const map = new Map<string, GroceryCommunityDealBadge>();
  for (const item of items) {
    const badge = findBestCommunityDealForItem(item, deals, storeLabelByKey);
    if (badge) map.set(item.id, badge);
  }
  return map;
}
