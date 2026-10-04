/**
 * Store page URL resolution — chains vs Google Maps fallback (never raw Overture websites).
 * Run from mobile/: npm run test:store-links
 */

import assert from 'node:assert/strict';
import type { StoreLocation } from '../lib/deals/types';
import {
  googleMapsPlaceSearchUrl,
  resolveStorePageUrl,
  resolveStorePageUsesGoogleMaps,
  resolveWeeklyAdLink,
} from '../lib/stores/storeLinks';

const base: StoreLocation = {
  id: 'test',
  name: 'Riverbank Market',
  chain: 'Riverbank Market',
  addressLine: '123 Main St',
  city: 'Riverbank',
  state: 'CA',
  zip: '95367',
  lat: 37.735,
  lng: -120.935,
  source: 'osm',
  pricingSource: 'none',
  website: 'https://dead-example.test/store',
};

assert.equal(
  resolveStorePageUrl(base),
  'https://www.google.com/maps/search/?api=1&query=Riverbank%20Market%20123%20Main%20St%20Riverbank%20CA%2095367',
  'non-chain ignores Overture website; opens Maps place search',
);
assert.equal(resolveStorePageUsesGoogleMaps(base), true, 'non-chain uses Maps label');

const saveMart: StoreLocation = {
  ...base,
  id: 'save-mart',
  name: 'Save Mart',
  chain: 'Save Mart',
  website: 'https://dead-savemart.test',
};
const saveMartUrl = resolveStorePageUrl(saveMart);
assert.ok(saveMartUrl.includes('savemart.com'), 'chain store page from storeChains');
assert.equal(resolveStorePageUsesGoogleMaps(saveMart), false, 'chain uses store page label');
assert.ok(!saveMartUrl.includes('dead-savemart'), 'chain ignores bad Overture website');

const smartFinal: StoreLocation = {
  ...saveMart,
  id: 'smart-final',
  name: 'Smart & Final',
  chain: 'Smart & Final',
};
assert.equal(resolveStorePageUrl(smartFinal), googleMapsPlaceSearchUrl(smartFinal), 'chain without locator uses Maps');
assert.equal(resolveStorePageUsesGoogleMaps(smartFinal), true, 'no locator => Maps label');
assert.equal(resolveWeeklyAdLink(smartFinal)?.url.includes('smartandfinal.com'), true, 'weekly ad still from chain');

const safeway: StoreLocation = {
  ...saveMart,
  id: 'safeway',
  name: 'Safeway',
  chain: 'Safeway',
  addressLine: '1441 E F St',
  city: 'Oakdale',
  zip: '95361',
};
const safewayPage = resolveStorePageUrl(safeway);
assert.ok(safewayPage.includes('safeway.com/store-locator'), 'safeway locator template');
assert.ok(safewayPage.includes('Oakdale'), 'safeway locator includes address query');

const maps = googleMapsPlaceSearchUrl(base);
assert.ok(maps.includes('Riverbank%20Market'), 'maps search uses name + address, not lat/lng');
assert.ok(!maps.includes('37.735'), 'maps search does not use raw coordinates when address present');

console.log('store-links-check: ok');
