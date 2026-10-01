import { COMMUNITY_DEALS } from '../../config/communityDeals';
import type { GroceryListItem } from '../../types/mealprep';
import { matchCommunityDealToGroceryItem } from './matchItem';
import type { CommunityStoreDeal } from './types';

/** Drop demo/sample rows and deals that do not match the shopper's list. */
export function communityDealsForGroceryList(
  deals: CommunityStoreDeal[],
  items: GroceryListItem[],
): CommunityStoreDeal[] {
  if (items.length === 0) return [];
  return deals.filter((deal) => {
    if (deal.isSample) return false;
    return items.some(
      (item) => matchCommunityDealToGroceryItem(item, deal) >= COMMUNITY_DEALS.fuzzyMatchMinScore,
    );
  });
}
