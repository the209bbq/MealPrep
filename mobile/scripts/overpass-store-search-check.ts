/**
 * Overpass mirror race + stale-while-revalidate preview checks.
 * Run from mobile/: npx tsx scripts/overpass-store-search-check.ts
 */

import { SMART_SHOP_STORES } from '../config/smartShop';
import { writeCache } from '../lib/stores/cache';
import { buildOverpassGroceryQuery } from '../lib/stores/groceryFilter';
import { overpassCacheKey, readCachedOverpassStores } from '../lib/stores/overpass';
import { raceOverpassMirrors } from '../lib/stores/overpassFetch';
import { resolveSearchOriginFast } from '../lib/stores/resolveOrigin';
import type { StoreRecord } from '../lib/stores/types';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const origin = { lat: 37.7665, lng: -120.8471 };
const radiusMiles = SMART_SHOP_STORES.defaultRadiusMiles;
const cacheKey = overpassCacheKey(origin, radiusMiles);

const sampleStores: StoreRecord[] = [
  {
    id: 'osm-node-1',
    name: 'Save Mart',
    chain: 'Save Mart',
    addressLine: '1 Main',
    city: 'Oakdale',
    state: 'CA',
    zip: '95361',
    lat: origin.lat,
    lng: origin.lng,
    distanceMiles: 0.5,
    source: 'osm',
    pricingSource: 'none',
  },
];

writeCache(cacheKey, sampleStores, SMART_SHOP_STORES.cacheTtlMs);
const cached = readCachedOverpassStores(origin, radiusMiles);
assert(cached?.length === 1, 'expected cached stores to be readable immediately');

const fastOrigin = resolveSearchOriginFast({ zip: '95361', radiusMiles });
assert(fastOrigin != null, 'built-in ZIP table should resolve Oakdale instantly');
const instantCache = readCachedOverpassStores(fastOrigin, radiusMiles);
assert(instantCache?.length === 1, 'cached stores should be readable before any network fetch');

const query = buildOverpassGroceryQuery(origin.lat, origin.lng, 16093, 10);
assert(query.includes('[timeout:10]'), 'overpass query should use server timeout 10');
assert(!query.includes('wholesale'), 'overpass query should omit wholesale shops');
assert(query.includes('Q483551'), 'overpass query should include Walmart wikidata');
assert(query.includes('Q1046951'), 'overpass query should include Target wikidata');
assert(query.includes('department_store|general'), 'overpass query should include big-box shop tags');

const fastElements = [{ type: 'node', id: 99, lat: origin.lat, lon: origin.lng, tags: { shop: 'supermarket', name: 'Fast Mart' } }];
const endpoints = ['https://mirror-slow.test', 'https://mirror-fail.test', 'https://mirror-fast.test'];

const originalFetch = globalThis.fetch;
let fetchCalls = 0;

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  fetchCalls += 1;
  const url = String(input);
  const signal = init?.signal;

  if (url.includes('mirror-slow')) {
    return new Promise<Response>(() => {
      signal?.addEventListener('abort', () => undefined);
    });
  }
  if (url.includes('mirror-fail')) {
    return new Response(JSON.stringify({ elements: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (url.includes('mirror-fast')) {
    await new Promise((r) => setTimeout(r, 40));
    return new Response(JSON.stringify({ elements: fastElements }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return originalFetch(input, init);
};

async function main(): Promise<void> {
  const started = Date.now();
  const raced = await raceOverpassMirrors(query, endpoints);
  const elapsed = Date.now() - started;

  assert(!('reason' in raced), `expected fast mirror to win, got ${JSON.stringify(raced)}`);
  assert(elapsed < SMART_SHOP_STORES.overpassOverallTimeoutMs, `race should finish within overall cap (${elapsed}ms)`);
  assert(elapsed < 3_000, `expected fast mirror result in under 3s, took ${elapsed}ms`);
  assert(fetchCalls >= 3, 'all mirrors should be contacted in parallel');

  globalThis.fetch = originalFetch;

  console.log('overpass-store-search-check: ok');
}

main().catch((err) => {
  globalThis.fetch = originalFetch;
  throw err;
});
