/**
 * Stores tab nearby list pipeline — filter, merge, chains first then local markets, list caps.
 * Run from mobile/: npm run test:stores-nearby-pipeline
 */

import { STORES_TAB_DISPLAY_LIMIT, STORES_TAB_LOCAL_MARKETS_LIMIT } from '../config/storesTab';
import { STORE_SEARCH } from '../config/storeSearch';
import { isNearbyListStoreNameAllowed } from '../lib/stores/catalogStoreFilter';
import {
  filterCatalogStoresForNearbyList,
  finalizeStoresTabNearbyList,
  mergeCatalogWithKrogerLocations,
  sortAndLimitStoresForStoresTab,
} from '../lib/stores/storesNearbyPipeline';
import { nearbyStoresCacheKey } from '../lib/stores/storeSearchCache';
import { isRecognizedStore, splitStoresByRecognition } from '../lib/stores/storeRecognition';
import {
  rowToStoreRecord,
  selectNearbyCatalogStores,
  type NearbyStoresRow,
} from '../lib/stores/nearbyCatalogRows';
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
assert(capped[0].name === 'Cost Less Food Company', 'a known chain leads the list even when 30 unbranded rows are closer');
assert(
  capped.length === 1 + STORES_TAB_LOCAL_MARKETS_LIMIT,
  'unbranded rows are capped separately from recognised stores',
);

assert(STORE_SEARCH.nearbyRpcLimit >= 100, 'RPC fetch reaches past the unbranded rows nearest a town centre');
assert(STORE_SEARCH.nearbyRpcLimit <= 200, 'RPC fetch stays within the nearby_stores server cap');

const cacheKey = nearbyStoresCacheKey(oakdaleOrigin, 24000);
assert(cacheKey.includes('stores:nearby:v3:'), 'nearby stores cache bumped to v3 (rows now carry knownBrand)');

// --- Chains first (research handoff 15) ---

function catalogRow(partial: Partial<NearbyStoresRow> & Pick<NearbyStoresRow, 'id' | 'name' | 'distance_m'>): NearbyStoresRow {
  return {
    brand: null,
    category: 'grocery_store',
    address_line: '',
    city: 'Stockton',
    state: 'CA',
    zip: '95215',
    lat: 37.9,
    lng: -121.15,
    phone: null,
    website: null,
    opening_hours: null,
    sources: null,
    ...partial,
  };
}

// Shapes taken from the live table near Stockton and Oakdale on 2026-10-09.
const farm = rowToStoreRecord(catalogRow({ id: 'farm', name: 'Nilsson Farms', distance_m: 2700, lat: 37.92 }));
const dairy = rowToStoreRecord(catalogRow({ id: 'dairy', name: 'E & R Prins Dairy', distance_m: 8800, lat: 37.96 }));
const traderJoes = rowToStoreRecord(
  catalogRow({ id: 'tj', name: "Trader Joe's", brand: "Trader Joe's", distance_m: 8400, lat: 37.98, lng: -121.2 }),
);
const costcoNoBrand = rowToStoreRecord(catalogRow({ id: 'costco', name: 'Costco Wholesale', distance_m: 11700, lat: 38.02 }));
const brandedLocal = rowToStoreRecord(
  catalogRow({ id: 'obriens', name: "O'Brien's Market", brand: "O'Brien's Market", distance_m: 2400 }),
);
const closedChain = rowToStoreRecord(
  catalogRow({ id: 'fresh-easy', name: 'Fresh & Easy Neighborhood Market', distance_m: 14800 }),
);

assert(!isRecognizedStore(farm) && !isRecognizedStore(dairy), 'unbranded farm and dairy rows are not recognised');
assert(isRecognizedStore(traderJoes), 'branded chain row is recognised');
assert(isRecognizedStore(costcoNoBrand), 'known chain is recognised even when the row has no brand');
assert(isRecognizedStore(brandedLocal), 'a row with a brand is recognised');
assert(closedChain.chain !== 'Walmart', 'Fresh & Easy Neighborhood Market is not relabelled as Walmart');
assert(!isRecognizedStore(closedChain), 'Fresh & Easy Neighborhood Market is not treated as a known chain');
assert(
  isRecognizedStore({ name: 'Kroger', chain: 'Kroger', source: 'kroger', krogerLocationId: '70300022' }),
  'Kroger feed rows are recognised',
);
assert(isRecognizedStore({ name: 'My corner shop', chain: 'My corner shop', source: 'manual' }), 'saved stores are recognised');

const stocktonOrigin = { lat: 37.9, lng: -121.15 };
const chainsFirst = sortAndLimitStoresForStoresTab([farm, dairy, traderJoes, costcoNoBrand], stocktonOrigin);
const split = splitStoresByRecognition(chainsFirst);
assert(
  chainsFirst.slice(0, split.recognized.length).every((s) => isRecognizedStore(s)),
  'recognised stores come before local markets',
);
assert(chainsFirst[0].id === 'tj', 'nearest recognised store is first even though a farm is closer');
assert(chainsFirst[1].id === 'costco', 'recognised stores stay closest first');
assert(split.local.map((s) => s.id).join(',') === 'farm,dairy', 'local markets stay closest first');

// The fetch keeps the nearest recognised stores even when unbranded rows fill the nearest slots.
const crowded: StoreRecord[] = [
  ...Array.from({ length: 150 }, (_, i) =>
    rowToStoreRecord(catalogRow({ id: `junk-${i}`, name: `Corner Listing ${i}`, distance_m: 100 + i })),
  ),
  rowToStoreRecord(catalogRow({ id: 'far-savemart', name: 'Save Mart', brand: 'Save Mart', distance_m: 9000 })),
];
const kept = selectNearbyCatalogStores(crowded);
assert(kept.some((s) => s.id === 'far-savemart'), 'a supermarket behind 150 unbranded rows is kept');
assert(kept.length === STORE_SEARCH.nearbyKeepPerGroup + 1, 'unbranded rows are trimmed to the per-group cap');
assert(kept[0].id === 'junk-0', 'kept rows stay in nearest-first order');
assert(
  selectNearbyCatalogStores([rowToStoreRecord(catalogRow({ id: 'smoke', name: 'Valley Smoke Shop', distance_m: 50 }))]).length === 0,
  'blocklisted names are dropped before trimming',
);

console.log('stores-nearby-pipeline-check: ok');
