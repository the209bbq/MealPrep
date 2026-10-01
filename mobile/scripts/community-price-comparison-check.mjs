#!/usr/bin/env node
import assert from 'node:assert/strict';
import { COMMUNITY_DEALS } from '../config/communityDeals.ts';
import { resolvePriceValidity, defaultRegularValidUntil } from '../lib/communityDeals/priceValidity.ts';
import { communityLineTotalForItem } from '../lib/communityDeals/communityLineTotal.ts';
import { mergeCommunityDealsIntoSearchResult } from '../lib/communityDeals/mergeIntoDeals.ts';
import { assembleDealsResult } from '../lib/deals/buildShopResult.ts';
import { isPastLocalDate } from '../lib/communityDeals/localDate.ts';

assert.equal(COMMUNITY_DEALS.regularPriceValidDays, 30);

const regular = resolvePriceValidity({});
assert.equal(regular.priceKind, 'regular');
const regularUntil = new Date(regular.validUntil);
const expectedUntil = new Date();
expectedUntil.setDate(expectedUntil.getDate() + 30);
assert.equal(regularUntil.toDateString(), expectedUntil.toDateString());

const sale = resolvePriceValidity({ saleValidUntil: '2099-12-31' });
assert.equal(sale.priceKind, 'sale');
assert.equal(sale.validUntil, '2099-12-31');

const item = {
  id: 'g1',
  ingredientId: 'ing-1',
  name: 'chicken breast',
  quantity: 24,
  unit: 'oz',
  checked: false,
  category: 'meats',
  sourceRecipeIds: [],
};

const deal = {
  id: 'd1',
  storeKey: 'save_mart',
  itemName: 'chicken breast',
  price: 3.99,
  unit: '16 oz',
  priceKind: 'regular',
  reportedBy: 'u1',
  createdAt: new Date().toISOString(),
  confirmCount: 0,
  expiredCount: 0,
};

assert.equal(communityLineTotalForItem(deal, item), 7.98);

const store = {
  id: 'store-1',
  name: 'Save Mart',
  chain: 'Save Mart',
  addressLine: '1 Main',
  city: 'Oakdale',
  state: 'CA',
  zip: '95361',
  pricingSource: 'none',
};

const base = assembleDealsResult({
  mode: 'live',
  providerId: 'community',
  providerLabel: 'shopper reports',
  stores: [store],
  deals: [],
  items: [item],
});

const merged = mergeCommunityDealsIntoSearchResult(base, [deal], [item]);
assert.equal(merged.deals.length, 1);
assert.equal(merged.deals[0].lineTotal, 7.98);
assert.equal(merged.deals[0].priceSource, 'community');
assert.equal(merged.storeTotals[0].pricesAvailable, true);

assert.equal(isPastLocalDate('2000-01-01'), true);
assert.equal(isPastLocalDate(defaultRegularValidUntil()), false);

const saleDeal = { ...deal, priceKind: 'sale', validUntil: '2099-06-01' };
const saleMerged = mergeCommunityDealsIntoSearchResult(base, [saleDeal], [item]);
assert.equal(saleMerged.deals[0].promoLabel, 'Sale');

console.log('community-price-comparison-check: ok');
