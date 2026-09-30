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
