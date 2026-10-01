import type { DealPriceSource, DealsSearchResult, ItemStoreDeal, StoreCartTotal } from '../deals/types';

/** Kroger API and user-reported community deals — never sample/demo hashes. */
export function isRealPriceSource(source: DealPriceSource | undefined): boolean {
  return source === 'kroger' || source === 'community';
}

export function isRealPriceDeal(deal: ItemStoreDeal): boolean {
  return isRealPriceSource(deal.priceSource);
}

export function storeTotalHasRealPrices(
  total: StoreCartTotal,
  deals: ItemStoreDeal[],
): boolean {
  if (!total.pricesAvailable || total.itemCount <= 0) return false;
  const storeDeals = deals.filter((d) => d.storeId === total.storeId);
  return storeDeals.some(isRealPriceDeal);
}

export function resultHasRealStorePricing(result: DealsSearchResult): boolean {
  return result.storeTotals.some((t) => storeTotalHasRealPrices(t, result.deals));
}

export function realDealsOnly(deals: ItemStoreDeal[]): ItemStoreDeal[] {
  return deals.filter(isRealPriceDeal);
}
