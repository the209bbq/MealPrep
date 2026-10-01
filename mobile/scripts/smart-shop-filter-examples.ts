/**
 * Smart Shop store filter smoke tests (no test runner in repo).
 * Run from mobile/: npm run test:smart-shop
 */

import {
  dedupeGroceryStoresByName,
  isAllowedOsmGroceryElement,
  resolveGroceryChainFromHaystack,
} from '../lib/stores/groceryFilter';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

assert(!isAllowedOsmGroceryElement({ shop: 'convenience', name: '7-Eleven' }), 'exclude convenience');
assert(isAllowedOsmGroceryElement({ shop: 'supermarket', name: 'Save Mart', brand: 'Save Mart' }), 'save mart');
assert(!isAllowedOsmGroceryElement({ shop: 'supermarket', brand: 'Save Mart' }), 'unnamed');
assert(isAllowedOsmGroceryElement({ shop: 'wholesale', name: 'Costco Wholesale' }), 'costco wholesale');
assert(!isAllowedOsmGroceryElement({ shop: 'wholesale', name: 'Restaurant Depot' }), 'restaurant depot');
assert(!isAllowedOsmGroceryElement({ shop: 'supermarket', name: 'Dollar General' }), 'dollar');
assert(
  isAllowedOsmGroceryElement({ shop: 'department_store', name: 'Walmart Neighborhood Market', brand: 'Walmart' }),
  'walmart neighborhood dept store',
);
assert(!isAllowedOsmGroceryElement({ shop: 'department_store', name: 'Kohl\'s' }), 'kohls dept');

const chain = resolveGroceryChainFromHaystack('save mart oakdale');
assert(chain?.key === 'save_mart', 'chain key');

const deduped = dedupeGroceryStoresByName([
  {
    id: 'a',
    name: 'Save Mart',
    chain: 'Save Mart',
    addressLine: '1',
    city: '',
    state: 'CA',
    zip: '',
    lat: 37.77,
    lng: -120.82,
    distanceMiles: 1,
    source: 'osm',
    pricingSource: 'none',
  },
  {
    id: 'b',
    name: 'Save Mart',
    chain: 'Save Mart',
    addressLine: '2',
    city: '',
    state: 'CA',
    zip: '',
    lat: 37.7705,
    lng: -120.8205,
    distanceMiles: 1.1,
    source: 'osm',
    pricingSource: 'none',
  },
]);
assert(deduped.length === 1, 'dedupe');

console.log('Smart Shop filter examples passed.');
