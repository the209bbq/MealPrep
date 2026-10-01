/**
 * Smart Shop honesty + location regression tests.
 * Run from mobile/: npx tsx scripts/smart-shop-honesty-tests.ts
 */

import { assembleDealsResult } from '../lib/deals/buildShopResult';
import { coordsForStoreSearch } from '../lib/smartShop/coordsResolve';
import { estimateSmartShopSavings } from '../lib/smartShop/aggregateDeals';
import type { ItemStoreDeal, StoreLocation } from '../lib/deals/types';
import type { GroceryListItem } from '../types/mealprep';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const stores: StoreLocation[] = [
  {
    id: 's1',
    name: 'Save Mart',
    chain: 'Save Mart',
    addressLine: '1 Main',
    city: 'Oakdale',
    state: 'CA',
    zip: '95361',
    pricingSource: 'none',
  },
  {
    id: 's2',
    name: 'Food Maxx',
    chain: 'Food Maxx',
    addressLine: '2 Main',
    city: 'Oakdale',
    state: 'CA',
    zip: '95361',
    pricingSource: 'none',
  },
];

const items: GroceryListItem[] = [
  {
    id: 'i1',
    ingredientId: 'ing-1',
    name: 'Milk',
    category: 'dairy',
    quantity: 1,
    unit: 'each',
    checked: false,
    sourceRecipeIds: [],
  },
];

function fakeSampleDeals(): ItemStoreDeal[] {
  const deals: ItemStoreDeal[] = [];
  for (const store of stores) {
    deals.push({
      groceryItemId: 'i1',
      storeId: store.id,
      productTitle: 'Milk',
      unitPrice: store.id === 's1' ? 3.5 : 5.5,
      lineTotal: store.id === 's1' ? 3.5 : 5.5,
      quantity: 1,
      unit: 'each',
      priceSource: 'sample',
    });
  }
  return deals;
}

const liveNoReal = assembleDealsResult({
  mode: 'live',
  providerId: 'none',
  providerLabel: 'No live prices',
  stores,
  deals: fakeSampleDeals(),
  items,
});

assert(estimateSmartShopSavings(liveNoReal, 1) === null, 'no savings ranking without real prices');
assert(
  !liveNoReal.suggestion.label.startsWith('Best value'),
  'live mode should not claim best value on sample-only deals',
);

const liveWithCommunity = assembleDealsResult({
  mode: 'live',
  providerId: 'community',
  providerLabel: 'Community',
  stores,
  deals: [
    {
      groceryItemId: 'i1',
      storeId: 's1',
      productTitle: 'Milk',
      unitPrice: 2.99,
      lineTotal: 2.99,
      quantity: 1,
      unit: 'each',
      priceSource: 'community',
    },
    {
      groceryItemId: 'i1',
      storeId: 's2',
      productTitle: 'Milk',
      unitPrice: 3.49,
      lineTotal: 3.49,
      quantity: 1,
      unit: 'each',
      priceSource: 'community',
    },
  ],
  items,
});

assert(estimateSmartShopSavings(liveWithCommunity, 1) != null, 'savings when two real community prices');

assert(
  coordsForStoreSearch({
    savedCoords: null,
    profileZip: '95361',
    profileLat: 37.77,
    profileLng: -120.82,
  }) === undefined,
  'ZIP without saved coords should not reuse stale profile GPS',
);

assert(
  coordsForStoreSearch({
    savedCoords: { lat: 37.5, lng: -121.0, updatedAt: new Date().toISOString() },
    profileZip: '95361',
    profileLat: 37.77,
    profileLng: -120.82,
  })?.lat === 37.5,
  'saved coords win when present',
);

console.log('Smart Shop honesty tests passed.');
