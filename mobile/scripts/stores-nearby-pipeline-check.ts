/**
 * Stores tab nearby list pipeline — filter, merge, closest-first sort, 15-store cap.
 * Run from mobile/: npm run test:stores-nearby-pipeline
 */

import { STORES_TAB_DISPLAY_LIMIT } from '../config/storesTab';
import { STORE_SEARCH } from '../config/storeSearch';
import { isNearbyListStoreNameAllowed } from '../lib/stores/catalogStoreFilter';
import {
  filterCatalogStoresForNearbyList,
  finalizeStoresTabNearbyList,
  mergeCatalogWithKrogerLocations,
  sortAndLimitStoresForStoresTab,
} from '../lib/stores/storesNearbyPipeline';
import { nearbyStoresCacheKey } from '../lib/stores/storeSearchCache';
import type { StoreRecord } from '../lib/stores/types';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const oakdaleOrigin = { lat: 37.7915, lng: -120.7861 };

for (const name of ["Cost Less Food Company", "Raley's", 'Save Mart', 'Grocery Outlet']) {
  assert(isNearbyListStoreNameAllowed(name, name), `${name} allowed in catalog filter`);
}

const rpcRows: StoreRecord[] = [
  {
    id: 'cost-less',
    name: 'Cost Less Food Company',
    chain: 'Cost Less Food Co.',
    addressLine: '401 E F St',
    city: 'Oakdale',
    state: 'CA',
    zip: '95361',
    lat: 37.7768,
    lng: -120.8452,
    distanceMiles: 1.1,
    source: 'osm',
    pricingSource: 'none',
    openNow: false,
  },
  {
    id: 'raleys',
    name: "Raley's",
    chain: "Raley's",
    addressLine: '1320 E F St',
    city: 'Oakdale',
    state: 'CA',
    zip: '95361',
    lat: 37.7675,
    lng: -120.8298,
    distanceMiles: 2.5,
    source: 'osm',
    pricingSource: 'none',
    openNow: true,
  },
  {
    id: 'save-mart',
    name: 'Save Mart',
    chain: 'Save Mart',
    addressLine: '1441 E F St',
    city: 'Oakdale',
    state: 'CA',
    zip: '95361',
    lat: 37.7662,
    lng: -120.8281,
    distanceMiles: 2.8,
    source: 'osm',
    pricingSource: 'none',
    openNow: true,
  },
  {
    id: 'grocery-outlet',
    name: 'Grocery Outlet',
    chain: 'Grocery Outlet',
    addressLine: '2500 E Whitmore Ave',
    city: 'Ceres',
    state: 'CA',
    zip: '95307',
    lat: 37.5942,
    lng: -120.9394,
    distanceMiles: 14,
    source: 'osm',
    pricingSource: 'none',
    openNow: false,
  },
];

const filtered = filterCatalogStoresForNearbyList(rpcRows);
assert(
  filtered.some((s) => s.name === 'Cost Less Food Company'),
  'Cost Less survives catalog filter',
);
assert(
  filtered.some((s) => s.name === "Raley's") &&
    filtered.some((s) => s.name === 'Save Mart') &&
    filtered.some((s) => s.name === 'Grocery Outlet'),
  'Raleys, Save Mart, Grocery Outlet survive filter',
);

const merged = mergeCatalogWithKrogerLocations(filtered, []);
const listed = finalizeStoresTabNearbyList(merged, oakdaleOrigin, { displayLimit: STORES_TAB_DISPLAY_LIMIT });
assert(listed.some((s) => s.name === 'Cost Less Food Company'), 'Cost Less in finalized Stores tab list for 95361');

const withOpenNowFirstInput: StoreRecord[] = [
  {
    ...rpcRows[0],
    openNow: false,
  },
  {
    ...rpcRows[1],
    lat: 38.5,
    lng: -121.5,
    openNow: true,
  },
];
const sorted = sortAndLimitStoresForStoresTab(withOpenNowFirstInput, oakdaleOrigin, 15);
assert(sorted[0].name === 'Cost Less Food Company', 'closest store first even when another is open now');

const manyStores: StoreRecord[] = Array.from({ length: 30 }, (_, i) => ({
  id: `store-${i}`,
  name: `Store ${i}`,
  chain: `Store ${i}`,
  addressLine: '',
  city: 'Oakdale',
  state: 'CA',
  zip: '95361',
  lat: 38.5 + i * 0.01,
  lng: -121.2,
  distanceMiles: 40 + i,
  source: 'osm',
  pricingSource: 'none',
}));
manyStores.push(rpcRows[0]);
const capped = sortAndLimitStoresForStoresTab(manyStores, oakdaleOrigin, STORES_TAB_DISPLAY_LIMIT);
assert(capped.length === STORES_TAB_DISPLAY_LIMIT, 'list capped at 15');
assert(
  capped.some((s) => s.name === 'Cost Less Food Company'),
  'Cost Less kept when within 15 closest after sort',
);

assert(STORE_SEARCH.nearbyRpcLimit >= 40, 'RPC fetch limit leaves headroom before 15-store cap');

const cacheKey = nearbyStoresCacheKey(oakdaleOrigin, 24000);
assert(cacheKey.includes('stores:nearby:v2:'), 'nearby stores cache bumped to v2');

console.log('stores-nearby-pipeline-check: ok');
