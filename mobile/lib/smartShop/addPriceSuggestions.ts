import { COMMUNITY_DEALS } from '../../config/communityDeals';
import { matchCommunityDealToGroceryItem } from '../communityDeals/matchItem';
import type { CommunityStoreDeal } from '../communityDeals/types';
import type { DealsSearchResult, ItemStoreDeal } from '../deals/types';
import type { GroceryListItem } from '../../types/mealprep';
import { itemNameKey, readRememberedSizeUnit } from './addPriceMemory';

export function groceryItemSizeUnit(item: GroceryListItem): string {
  const unit = item.unit.trim();
  if (!unit) return '';
  const qty = item.quantity;
  if (!Number.isFinite(qty) || qty <= 0 || qty === 1) return unit;
  const rounded = Math.round(qty * 100) / 100;
  return `${rounded} ${unit}`;
}

export function sizeUnitForGroceryItem(
  ownerId: string,
  item: GroceryListItem,
): string {
  return readRememberedSizeUnit(ownerId, item.name) ?? groceryItemSizeUnit(item);
}

export interface AddPriceItemSuggestion {
  item: GroceryListItem;
  hasPriceAtStore: boolean;
}

function itemHasCommunityPriceAtStore(
  item: GroceryListItem,
  storeKey: string,
  deals: CommunityStoreDeal[],
): boolean {
  for (const deal of deals) {
    if (deal.storeKey !== storeKey) continue;
    if (matchCommunityDealToGroceryItem(item, deal) >= COMMUNITY_DEALS.fuzzyMatchMinScore) {
      return true;
    }
  }
  return false;
}

function itemHasComparisonPriceAtStore(
  item: GroceryListItem,
  storeId: string,
  comparisonDeals: ItemStoreDeal[],
): boolean {
  return comparisonDeals.some((d) => d.groceryItemId === item.id && d.storeId === storeId);
}

export function buildAddPriceItemSuggestions(input: {
  groceryItems: GroceryListItem[];
  storeKey: string | null;
  storeId: string | null;
  communityDeals: CommunityStoreDeal[];
  dealsResult?: DealsSearchResult | null;
}): AddPriceItemSuggestion[] {
  const openItems = input.groceryItems.filter((i) => !i.checked);
  const comparisonDeals = input.dealsResult?.deals ?? [];

  const suggestions: AddPriceItemSuggestion[] = openItems.map((item) => {
    let hasPrice = false;
    if (input.storeKey) {
      hasPrice = itemHasCommunityPriceAtStore(item, input.storeKey, input.communityDeals);
    }
    if (!hasPrice && input.storeId) {
      hasPrice = itemHasComparisonPriceAtStore(item, input.storeId, comparisonDeals);
    }
    return { item, hasPriceAtStore: hasPrice };
  });

  suggestions.sort((a, b) => {
    if (a.hasPriceAtStore !== b.hasPriceAtStore) return a.hasPriceAtStore ? 1 : -1;
    return a.item.name.localeCompare(b.item.name);
  });

  return suggestions;
}

export function findGroceryItemByName(
  items: GroceryListItem[],
  itemName: string,
): GroceryListItem | undefined {
  const key = itemNameKey(itemName);
  return items.find((i) => itemNameKey(i.name) === key);
}

export function nextUnpricedSuggestion(
  suggestions: AddPriceItemSuggestion[],
  afterItemId?: string | null,
): AddPriceItemSuggestion | undefined {
  const unpriced = suggestions.filter((s) => !s.hasPriceAtStore);
  if (unpriced.length === 0) return undefined;
  if (!afterItemId) return unpriced[0];
  const idx = unpriced.findIndex((s) => s.item.id === afterItemId);
  if (idx < 0) return unpriced[0];
  return unpriced[idx + 1] ?? unpriced[0];
}
