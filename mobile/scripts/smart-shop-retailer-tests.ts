/**
 * Retailer brand matching + search URL builders.
 * Run from mobile/: npm run test:smart-shop
 */

import { isAllowedOsmGroceryElement } from '../lib/stores/groceryFilter';
import {
  buildCombinedListSearchQuery,
  fillRetailerTemplate,
  osmTagsMatchRetailer,
  retailerItemSearchUrl,
  retailerWholeListSearchUrl,
} from '../lib/smartShop/retailerLinks';
import { retailerConfigById } from '../config/smartShopRetailers';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const walmart = retailerConfigById('walmart');
const target = retailerConfigById('target');

assert(
  isAllowedOsmGroceryElement({
    shop: 'department_store',
    name: 'Walmart Supercenter',
    'brand:wikidata': 'Q483551',
  }),
  'walmart wikidata department_store',
);
assert(
  isAllowedOsmGroceryElement({ shop: 'general', name: 'Target', brand: 'Target', 'brand:wikidata': 'Q1046951' }),
  'target general',
);
assert(
  isAllowedOsmGroceryElement({ shop: 'department_store', name: 'Target', brand: 'Target' }),
  'target by brand',
);
assert(
  !isAllowedOsmGroceryElement({ shop: 'department_store', name: "Macy's", brand: "Macy's" }),
  'exclude other department stores',
);
assert(osmTagsMatchRetailer({ brand: 'Walmart', name: 'Walmart' }, walmart), 'osm walmart brand');
assert(osmTagsMatchRetailer({ name: 'Target' }, target), 'osm target name');

const milkUrl = retailerItemSearchUrl(walmart, 'whole milk');
assert(milkUrl === 'https://www.walmart.com/search?q=whole%20milk', 'walmart item url');
const targetUrl = retailerItemSearchUrl(target, 'bananas');
assert(targetUrl === 'https://www.target.com/s?searchTerm=bananas', 'target item url');

assert(
  fillRetailerTemplate('https://example.com?q={query}', 'a & b') === 'https://example.com?q=a%20%26%20b',
  'encode query',
);

const combined = buildCombinedListSearchQuery(
  [{ name: 'milk' }, { name: 'eggs' }, { name: 'bread' }],
  20,
);
assert(combined === 'milk eggs bread', 'combined list query');

const wholeListUrl = retailerWholeListSearchUrl(walmart, [{ name: 'milk' }, { name: 'eggs' }]);
assert(wholeListUrl.includes('search?q='), 'whole list uses search');

console.log('smart-shop-retailer-tests: ok');
