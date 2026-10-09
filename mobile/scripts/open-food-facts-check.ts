/**
 * Pure-logic checks for the Open Food Facts barcode lookup (validation, parsing, errors, cache, headers).
 * Uses a fake fetch: never touches the network.
 */
import assert from 'node:assert/strict';
import {
  OPEN_FOOD_FACTS,
  openFoodFactsProductApiUrl,
  openFoodFactsProductPageUrl,
} from '../config/openFoodFacts.ts';
import { hasValidGtinCheckDigit, normalizeBarcode, toLookupBarcode } from '../lib/openFoodFacts/barcode.ts';
import {
  clearOpenFoodFactsCache,
  lookupOpenFoodFactsProduct,
  parseOpenFoodFactsProduct,
  suggestedPantryName,
} from '../lib/openFoodFacts/client.ts';

// --- barcode validation ---
assert.equal(normalizeBarcode(' 4006-3813 33931 '), '4006381333931');
assert.ok(hasValidGtinCheckDigit('4006381333931'), 'EAN-13');
assert.ok(hasValidGtinCheckDigit('036000291452'), 'UPC-A');
assert.ok(hasValidGtinCheckDigit('96385074'), 'EAN-8');
assert.ok(!hasValidGtinCheckDigit('4006381333932'), 'bad check digit');
assert.ok(!hasValidGtinCheckDigit('12345'), 'bad length');
assert.ok(!hasValidGtinCheckDigit('abcdefghijklm'), 'non-digits');
assert.equal(toLookupBarcode('036000291452'), '0036000291452', 'UPC-A padded to 13 digits');
assert.equal(toLookupBarcode('4006 3813 33931'), '4006381333931');
assert.equal(toLookupBarcode('123'), null);
assert.equal(toLookupBarcode(''), null);

// --- URLs ---
const apiUrl = openFoodFactsProductApiUrl('4006381333931');
assert.ok(apiUrl.startsWith('https://world.openfoodfacts.org/api/v2/product/4006381333931.json?fields='));
assert.ok(!apiUrl.includes('openfoodfacts.net'), 'must use production host, not staging');
assert.ok(decodeURIComponent(apiUrl).includes('product_name,generic_name,brands'));
assert.equal(openFoodFactsProductPageUrl('4006381333931'), 'https://world.openfoodfacts.org/product/4006381333931');
assert.match(OPEN_FOOD_FACTS.userAgent, /^MealPlanatic\/\d+\.\d+ \(.+@.+\)$/, 'User-Agent: AppName/Version (Email)');

// --- parsing ---
const fullBody = {
  status: 1,
  status_verbose: 'product found',
  code: '4006381333931',
  product: {
    product_name: '  Hazelnut Spread  ',
    brands: 'Acme Foods, Other Brand',
    quantity: '350 g',
    image_front_small_url: 'https://images.openfoodfacts.org/images/products/x/front.200.jpg',
    allergens_tags: ['en:milk', 'en:tree-nuts', 'en:milk', 42, 'fr:lait'],
    nutriscore_grade: 'E',
  },
};
const parsed = parseOpenFoodFactsProduct(fullBody, '4006381333931');
assert.ok(parsed);
assert.equal(parsed!.name, 'Hazelnut Spread');
assert.equal(parsed!.brand, 'Acme Foods');
assert.equal(parsed!.packageSize, '350 g');
assert.equal(parsed!.imageUrl, 'https://images.openfoodfacts.org/images/products/x/front.200.jpg');
assert.deepEqual(parsed!.allergens, ['milk', 'tree nuts', 'lait']);
assert.equal(parsed!.nutriScore, 'e');
assert.equal(parsed!.pageUrl, 'https://world.openfoodfacts.org/product/4006381333931');

// missing/odd fields never throw
const sparse = parseOpenFoodFactsProduct({ status: 1, product: { generic_name: 'Rice' } }, '96385074');
assert.ok(sparse);
assert.equal(sparse!.name, 'Rice');
assert.equal(sparse!.brand, null);
assert.equal(sparse!.packageSize, null);
assert.equal(sparse!.imageUrl, null);
assert.deepEqual(sparse!.allergens, []);
assert.equal(sparse!.nutriScore, null);

assert.equal(parseOpenFoodFactsProduct({ status: 0, status_verbose: 'product not found' }, '96385074'), null);
assert.equal(parseOpenFoodFactsProduct({ status: 1, product: { product_name: '   ' } }, '96385074'), null, 'no name');
assert.equal(parseOpenFoodFactsProduct(null, '96385074'), null);
assert.equal(parseOpenFoodFactsProduct('nope', '96385074'), null);
assert.equal(
  parseOpenFoodFactsProduct(
    { status: 1, product: { product_name: 'X', image_front_small_url: 'javascript:alert(1)' } },
    '96385074',
  )!.imageUrl,
  null,
  'unsafe image URL dropped',
);
assert.equal(
  parseOpenFoodFactsProduct({ status: 1, product: { product_name: 'X', nutriscore_grade: 'unknown' } }, '96385074')!
    .nutriScore,
  null,
);

// --- pantry name suggestion ---
assert.equal(suggestedPantryName({ name: 'Hazelnut Spread', brand: 'Acme Foods' }), 'Acme Foods Hazelnut Spread');
assert.equal(suggestedPantryName({ name: 'Acme Foods Hazelnut Spread', brand: 'Acme Foods' }), 'Acme Foods Hazelnut Spread');
assert.equal(suggestedPantryName({ name: 'Rice', brand: null }), 'Rice');

// --- lookup with a fake fetch ---
type Call = { url: string; headers: Record<string, string> };
function fakeFetch(
  respond: () => Response | Promise<Response>,
  calls: Call[] = [],
): { impl: typeof fetch; calls: Call[] } {
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: (init?.headers ?? {}) as Record<string, string> });
    return respond();
  }) as typeof fetch;
  return { impl, calls };
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function main() {
  // invalid barcode never hits the network
  clearOpenFoodFactsCache();
  const none = fakeFetch(() => json({}));
  assert.deepEqual(await lookupOpenFoodFactsProduct('12345', { fetchImpl: none.impl }), { status: 'invalid_barcode' });
  assert.equal(none.calls.length, 0);

  // found + headers + cache
  clearOpenFoodFactsCache();
  const ok = fakeFetch(() => json(fullBody));
  const found = await lookupOpenFoodFactsProduct('4006381333931', { fetchImpl: ok.impl });
  assert.equal(found.status, 'found');
  assert.equal(ok.calls.length, 1);
  assert.equal(ok.calls[0].headers['User-Agent'], OPEN_FOOD_FACTS.userAgent);
  assert.equal(ok.calls[0].headers.Accept, 'application/json');
  const again = await lookupOpenFoodFactsProduct('4006381333931', { fetchImpl: ok.impl });
  assert.equal(again.status, 'found');
  assert.equal(ok.calls.length, 1, 'second lookup served from cache');

  // cache expires
  let nowMs = 1_000;
  clearOpenFoodFactsCache();
  const expiring = fakeFetch(() => json(fullBody));
  await lookupOpenFoodFactsProduct('4006381333931', { fetchImpl: expiring.impl, now: () => nowMs });
  nowMs += OPEN_FOOD_FACTS.cacheTtlMs + 1;
  await lookupOpenFoodFactsProduct('4006381333931', { fetchImpl: expiring.impl, now: () => nowMs });
  assert.equal(expiring.calls.length, 2, 'refetched after TTL');

  // web: no User-Agent header
  clearOpenFoodFactsCache();
  const web = fakeFetch(() => json(fullBody));
  await lookupOpenFoodFactsProduct('4006381333931', { fetchImpl: web.impl, userAgent: null });
  assert.equal('User-Agent' in web.calls[0].headers, false, 'browsers cannot set User-Agent');

  // UPC-A queried as 13 digits
  clearOpenFoodFactsCache();
  const upc = fakeFetch(() => json(fullBody));
  await lookupOpenFoodFactsProduct('036000291452', { fetchImpl: upc.impl });
  assert.ok(upc.calls[0].url.includes('/product/0036000291452.json'));

  // not found: status 0 body, and HTTP 404 — both cached
  clearOpenFoodFactsCache();
  const missing = fakeFetch(() => json({ status: 0, status_verbose: 'product not found' }));
  assert.deepEqual(await lookupOpenFoodFactsProduct('96385074', { fetchImpl: missing.impl }), { status: 'not_found' });
  await lookupOpenFoodFactsProduct('96385074', { fetchImpl: missing.impl });
  assert.equal(missing.calls.length, 1, 'not-found is cached');
  clearOpenFoodFactsCache();
  const notFound404 = fakeFetch(() => json({}, 404));
  assert.deepEqual(await lookupOpenFoodFactsProduct('96385074', { fetchImpl: notFound404.impl }), {
    status: 'not_found',
  });

  // rate limited: 429 and 503, never cached
  for (const status of [429, 503]) {
    clearOpenFoodFactsCache();
    let n = 0;
    const throttled = fakeFetch(() => (n++ === 0 ? json({}, status) : json(fullBody)));
    assert.deepEqual(await lookupOpenFoodFactsProduct('4006381333931', { fetchImpl: throttled.impl }), {
      status: 'rate_limited',
    });
    const retry = await lookupOpenFoodFactsProduct('4006381333931', { fetchImpl: throttled.impl });
    assert.equal(retry.status, 'found', `retry after ${status} must not be served a cached failure`);
  }

  // server error + network error + bad JSON: error, never cached
  clearOpenFoodFactsCache();
  const server500 = fakeFetch(() => json({}, 500));
  const r500 = await lookupOpenFoodFactsProduct('4006381333931', { fetchImpl: server500.impl });
  assert.equal(r500.status, 'error');
  clearOpenFoodFactsCache();
  const offline = fakeFetch(() => {
    throw new TypeError('Network request failed');
  });
  const rOffline = await lookupOpenFoodFactsProduct('4006381333931', { fetchImpl: offline.impl });
  assert.deepEqual(rOffline, { status: 'error', message: 'Network request failed' });
  clearOpenFoodFactsCache();
  const garbage = fakeFetch(() => new Response('<html>oops</html>', { status: 200 }));
  assert.equal((await lookupOpenFoodFactsProduct('4006381333931', { fetchImpl: garbage.impl })).status, 'error');

  // timeout aborts the request
  clearOpenFoodFactsCache();
  const hung = (async (_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })) as typeof fetch;
  const timedOut = await lookupOpenFoodFactsProduct('4006381333931', { fetchImpl: hung, timeoutMs: 20 });
  assert.deepEqual(timedOut, { status: 'error', message: 'Open Food Facts timed out.' });

  console.log('open-food-facts-check: ok');
}

void main();
