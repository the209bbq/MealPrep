/**
 * Store page URL resolution — exact Overture page, prefilled locator, or Google Maps.
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
import { STORE_LINK_FALLBACK_ZIP } from '../lib/stores/storeLinkFixtures';

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

const saveMartExact: StoreLocation = {
  ...base,
  id: 'save-mart-exact',
  name: 'Save Mart',
  chain: 'Save Mart',
  city: 'Oakdale',
  zip: '95361',
  website: 'https://www.savemart.com/stores/693c06f6-0000-0000-0000-000000000000/OAKDALE/48/OAKDALE',
};
assert.equal(
  resolveStorePageUrl(saveMartExact),
  saveMartExact.website,
  'save mart uses Overture store page on savemart.com',
);
assert.equal(resolveStorePageUsesGoogleMaps(saveMartExact), false);

const saveMartNoPage: StoreLocation = {
  ...saveMartExact,
  id: 'save-mart-maps',
  website: 'https://savemart.com/?utm_source=google',
};
assert.equal(resolveStorePageUrl(saveMartNoPage), googleMapsPlaceSearchUrl(saveMartNoPage), 'bare homepage -> Maps');

const smartFinal: StoreLocation = {
  ...base,
  id: 'smart-final',
  name: 'Smart & Final',
  chain: 'Smart & Final',
  website: 'https://www.smartandfinal.com/sm/planning/rsid/811',
};
assert.equal(resolveStorePageUrl(smartFinal), smartFinal.website, 'smart final exact rsid page');
assert.equal(resolveWeeklyAdLink(smartFinal)?.url.includes('smartandfinal.com'), true, 'weekly ad still from chain');

const smartFinalNoUrl: StoreLocation = {
  ...smartFinal,
  website: undefined,
};
assert.equal(
  resolveStorePageUrl(smartFinalNoUrl),
  googleMapsPlaceSearchUrl(smartFinalNoUrl),
  'smart final without website uses Maps',
);

const safeway: StoreLocation = {
  ...base,
  id: 'safeway',
  name: 'Safeway',
  chain: 'Safeway',
  addressLine: '1441 E F St',
  city: 'Oakdale',
  zip: '95361',
};
const safewayPage = resolveStorePageUrl(safeway);
assert.ok(safewayPage.includes('safeway.com/store-locator'), 'safeway prefilled locator');
assert.ok(safewayPage.includes('95361'), 'safeway locator uses store zip');

const safewayLocal: StoreLocation = {
  ...safeway,
  website: 'https://local.safeway.com/safeway/ca/oakdale/1441-e-f-st.html',
};
assert.equal(resolveStorePageUrl(safewayLocal), safewayLocal.website, 'safeway local store page');

const publix: StoreLocation = {
  ...base,
  id: 'publix-tx',
  name: 'Publix',
  chain: 'Publix',
  addressLine: '1234 W Anderson Ln',
  city: 'Austin',
  state: 'TX',
  zip: '78757',
};
const publixPage = resolveStorePageUrl(publix);
assert.ok(publixPage.includes('publix.com/locations'), 'publix prefilled locator');
assert.ok(publixPage.includes('Austin'), 'publix locator uses address query');

const wincoNoZip: StoreLocation = {
  ...base,
  id: 'winco',
  name: 'WinCo Foods',
  chain: 'WinCo Foods',
  city: 'Boise',
  state: 'ID',
  zip: undefined,
};
const wincoMaps = resolveStorePageUrl(wincoNoZip, { fallbackZip: STORE_LINK_FALLBACK_ZIP });
assert.equal(wincoMaps, googleMapsPlaceSearchUrl(wincoNoZip), 'winco without locator uses Maps');

const hyvee: StoreLocation = {
  ...base,
  id: 'hyvee',
  name: 'Hy-Vee',
  chain: 'Hy-Vee',
  city: 'Des Moines',
  state: 'IA',
  zip: undefined,
};
const hyveePage = resolveStorePageUrl(hyvee, { fallbackZip: '50310' });
assert.ok(hyveePage.includes('hy-vee.com/stores'), 'hy-vee prefilled zip');
assert.ok(hyveePage.includes('50310'), 'hy-vee uses fallback zip');

const krogerExact: StoreLocation = {
  ...base,
  id: 'kroger',
  name: 'Kroger',
  chain: 'Kroger',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
  website: 'https://www.kroger.com/stores/details/034/00340',
};
assert.equal(resolveStorePageUrl(krogerExact), krogerExact.website, 'kroger exact store page');

const groceryOutlet: StoreLocation = {
  ...base,
  id: 'go',
  name: 'Grocery Outlet',
  chain: 'Grocery Outlet',
  website: 'https://www.groceryoutlet.com/circulars/storeid/192',
};
assert.equal(resolveStorePageUrl(groceryOutlet), groceryOutlet.website, 'grocery outlet store page from website');
assert.equal(
  resolveWeeklyAdLink(groceryOutlet)?.url,
  'https://www.groceryoutlet.com/circulars/storeid/192',
  'grocery outlet store weekly ad',
);

const maps = googleMapsPlaceSearchUrl(base);
assert.ok(maps.includes('Riverbank%20Market'), 'maps search uses name + address, not lat/lng');
assert.ok(!maps.includes('37.735'), 'maps search does not use raw coordinates when address present');

console.log('store-links-check: ok');
