import { SMART_SHOP_COPY } from '../../config/smartShop';
import type { DealsSearchResult, ItemStoreDeal, StoreCartTotal, StoreLocation } from '../deals/types';
import type { GroceryListItem } from '../../types/mealprep';
import { isRealPriceDeal, resultHasRealStorePricing, storeTotalHasRealPrices } from './realPricing';

export function bestDealPerStoreForItem(deals: ItemStoreDeal[], groceryItemId: string, storeId: string): ItemStoreDeal | undefined {
  const matches = deals.filter((d) => d.groceryItemId === groceryItemId && d.storeId === storeId);
  if (matches.length === 0) return undefined;
  return matches.reduce((best, current) => (current.lineTotal < best.lineTotal ? current : best));
}

export function bestDealAcrossStores(deals: ItemStoreDeal[], groceryItemId: string): ItemStoreDeal | undefined {
  const matches = deals.filter((d) => d.groceryItemId === groceryItemId);
  if (matches.length === 0) return undefined;
  return matches.reduce((best, current) => (current.lineTotal < best.lineTotal ? current : best));
}

export function openGroceryItems(grocery: GroceryListItem[]): GroceryListItem[] {
  return grocery.filter((item) => !item.checked);
}

export function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatStoreTotal(value: number, isEstimate: boolean): string {
  if (!isEstimate) return formatMoney(value);
  return `${formatMoney(value)} ${SMART_SHOP_COPY.estimatedSuffix}`;
}

export function isEstimatePricingMode(result: DealsSearchResult): boolean {
  return result.mode === 'sample';
}

export function storeHasPricedTotal(
  total: StoreCartTotal | undefined,
  result?: DealsSearchResult,
): boolean {
  if (!total?.pricesAvailable || total.itemCount <= 0) return false;
  if (!result || result.mode === 'sample') return true;
  return storeTotalHasRealPrices(total, result.deals);
}

export function dealsSummaryLabel(result: DealsSearchResult): string {
  const hasCommunity = result.deals.some((d) => d.priceSource === 'community');
  const communitySuffix = hasCommunity ? ' · community deals' : '';
  if (result.mode === 'sample') {
    return `${SMART_SHOP_COPY.estimatedPricesTitle}${communitySuffix}`;
  }
  return `${SMART_SHOP_COPY.livePricesLabel} · ${result.providerLabel}${communitySuffix}`;
}

export function dealsSummarySubtext(result: DealsSearchResult): string | undefined {
  if (result.mode === 'sample') return undefined;
  return result.pricingNote;
}

export function pricingBadgeForStore(
  store: StoreLocation,
  options?: {
    hasCommunityDeals?: boolean;
    resultMode?: DealsSearchResult['mode'];
    storeTotal?: StoreCartTotal;
    result?: DealsSearchResult;
  },
): string {
  const priced = storeHasPricedTotal(options?.storeTotal, options?.result);
  if (!priced) {
    return options?.hasCommunityDeals
      ? 'Community deals only'
      : SMART_SHOP_COPY.noPricesYetStore;
  }

  const estimate =
    options?.resultMode === 'sample' ||
    store.pricingSource === 'sample' ||
    (options?.storeTotal && options.storeTotal.pricesAvailable && store.pricingSource !== 'kroger');

  if (estimate) {
    return options?.hasCommunityDeals ? SMART_SHOP_COPY.estimatedWithCommunity : SMART_SHOP_COPY.estimatedBadge;
  }

  if (store.pricingSource === 'kroger') {
    return options?.hasCommunityDeals ? SMART_SHOP_COPY.livePricesWithCommunity : SMART_SHOP_COPY.livePricesLabel;
  }

  if (options?.hasCommunityDeals) return 'Community deals';
  return SMART_SHOP_COPY.estimatedBadge;
}

export interface SmartShopSavingsEstimate {
  savingsAmount: number;
  pricedItemCount: number;
  listItemCount: number;
  isDemoPricing: boolean;
}

export function estimateSmartShopSavings(
  result: DealsSearchResult,
  listItemCount: number,
): SmartShopSavingsEstimate | null {
  if (result.mode !== 'sample' && !resultHasRealStorePricing(result)) return null;

  const pricedTotals = result.storeTotals.filter((t) => storeHasPricedTotal(t, result));
  if (pricedTotals.length < 2) return null;

  const subtotals = pricedTotals.map((t) => t.subtotal);
  const maxSubtotal = Math.max(...subtotals);
  const minSubtotal = Math.min(...subtotals);
  const savingsAmount = Math.round((maxSubtotal - minSubtotal) * 100) / 100;
  if (savingsAmount <= 0) return null;

  const pricedItemCount = Math.max(...pricedTotals.map((t) => t.itemCount));

  return {
    savingsAmount,
    pricedItemCount,
    listItemCount,
    isDemoPricing: result.mode === 'sample',
  };
}

export function bestRealDealAcrossStores(deals: ItemStoreDeal[], groceryItemId: string): ItemStoreDeal | undefined {
  const matches = deals.filter((d) => d.groceryItemId === groceryItemId && isRealPriceDeal(d));
  if (matches.length === 0) return undefined;
  return matches.reduce((best, current) => (current.lineTotal < best.lineTotal ? current : best));
}

export function bestRealDealPerStoreForItem(
  deals: ItemStoreDeal[],
  groceryItemId: string,
  storeId: string,
): ItemStoreDeal | undefined {
  const matches = deals.filter(
    (d) => d.groceryItemId === groceryItemId && d.storeId === storeId && isRealPriceDeal(d),
  );
  if (matches.length === 0) return undefined;
  return matches.reduce((best, current) => (current.lineTotal < best.lineTotal ? current : best));
}
