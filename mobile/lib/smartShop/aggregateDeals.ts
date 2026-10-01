import type { DealsSearchResult, ItemStoreDeal } from '../deals/types';
import type { GroceryListItem } from '../../types/mealprep';

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

export function dealsSummaryLabel(result: DealsSearchResult): string {
  if (result.mode === 'sample') {
    return `SAMPLE deals · ${result.providerLabel}`;
  }
  return `Live Kroger prices · ${result.providerLabel}`;
}

export function pricingBadgeForStore(store: import('../deals/types').StoreLocation): string {
  if (store.pricingSource === 'kroger') return 'Kroger prices';
  if (store.pricingSource === 'sample') return 'Sample prices';
  return 'Prices not available';
}

export interface SmartShopSavingsEstimate {
  /** Highest store subtotal minus cheapest (same items priced). */
  savingsAmount: number;
  pricedItemCount: number;
  listItemCount: number;
  isDemoPricing: boolean;
}

/** Estimated savings when comparing store subtotals (real for Kroger live mode). */
export function estimateSmartShopSavings(
  result: DealsSearchResult,
  listItemCount: number,
): SmartShopSavingsEstimate | null {
  const pricedTotals = result.storeTotals.filter((t) => t.pricesAvailable && t.itemCount > 0);
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
