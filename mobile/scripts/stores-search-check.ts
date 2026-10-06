/**
 * Stores search helpers — ZCTA lookup, geohash cache key, regional fallback.
 * Run from mobile/: npm run test:stores-search
 */

import assert from 'node:assert/strict';
import { encodeGeohash, nearbyStoresCacheGeohash } from '../lib/stores/geohash';
import { chooseRegionalStaticFallback, isWithinOakdaleRegionalFallback, OAKDALE_FALLBACK_ORIGIN } from '../lib/stores/regionalFallback';
import { nearbyStoreSearchRadiusMeters } from '../lib/stores/storeSearchRadius';
import { nearbyStoresCacheKey } from '../lib/stores/storeSearchCache';
import { lookupZctaCentroid, nearestZctaZip } from '../lib/stores/zctaCentroids';

async function main() {
  const oakdale = await lookupZctaCentroid('95361');
  assert.ok(oakdale, '95361 in ZCTA table');
  assert.ok(Math.abs(oakdale!.lat - 37.79) < 0.1, 'Oakdale lat plausible');
  assert.ok(Math.abs(oakdale!.lng + 120.79) < 0.1, 'Oakdale lng plausible');

  const missing = await lookupZctaCentroid('00000');
  assert.equal(missing, null, 'invalid zip absent');

  const gh = encodeGeohash(37.77, -120.85, 5);
  assert.equal(gh.length, 5, 'geohash precision 5');
  assert.equal(nearbyStoresCacheGeohash(37.77, -120.85), gh);

  const key = nearbyStoresCacheKey({ lat: 37.77, lng: -120.85 }, 24000);
  assert.ok(key.includes(gh), 'cache key uses geohash');
  assert.ok(key.includes('24000'), 'cache key includes radius');

  assert.equal(nearbyStoreSearchRadiusMeters({ isGpsOrigin: false }), 24000);
  assert.equal(nearbyStoreSearchRadiusMeters({ isGpsOrigin: true }), 16000);
  assert.equal(nearbyStoreSearchRadiusMeters({ isGpsOrigin: true, radiusMultiplier: 2 }), 32000);

  assert.ok(isWithinOakdaleRegionalFallback(OAKDALE_FALLBACK_ORIGIN), 'oakdale center in region');
  assert.ok(!isWithinOakdaleRegionalFallback({ lat: 40.7, lng: -74.0 }), 'NYC outside region');

  const regional = chooseRegionalStaticFallback(OAKDALE_FALLBACK_ORIGIN);
  assert.ok(regional.length > 0, 'oakdale fallback json loads');
  const empty = chooseRegionalStaticFallback({ lat: 40.7, lng: -74.0 });
  assert.equal(empty.length, 0, 'no fallback far from oakdale');

  const nearest = await nearestZctaZip(37.7665, -120.8471);
  assert.equal(nearest, '95361', 'nearest ZCTA near Oakdale test coords');

  console.log('stores-search-check: ok');
}

void main();
