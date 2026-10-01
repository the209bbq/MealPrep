/**
 * Prints filtered grocery stores for Oakdale CA 95361 @ default radius (for PR notes).
 * Run: npx tsx scripts/oakdale-overpass-sample.ts
 */

import { haversineMiles, SMART_SHOP_STORES } from '../config/smartShop';
import { milesToMeters } from '../config/smartShop';
import {
  buildOverpassGroceryQuery,
  dedupeGroceryStoresByName,
  haystackFromTags,
  isAllowedOsmGroceryElement,
  rankGroceryStores,
  resolveGroceryChainFromHaystack,
} from '../lib/stores/groceryFilter';
import type { StoreRecord } from '../lib/stores/types';

const lat = 37.7728872;
const lng = -120.8238601;
const radiusMeters = Math.round(milesToMeters(SMART_SHOP_STORES.defaultRadiusMiles));
const query = buildOverpassGroceryQuery(lat, lng, radiusMeters, SMART_SHOP_STORES.maxOverpassResults);

async function main(): Promise<void> {
const body = new URLSearchParams({ data: query });
const res = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': '209MealPrep/1.0 Smart Shop',
  },
  body,
});

if (!res.ok) {
  console.error('Overpass HTTP', res.status);
  process.exit(1);
}

const json = (await res.json()) as {
  elements?: Array<{
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
  }>;
};

const stores: StoreRecord[] = [];
for (const el of json.elements ?? []) {
  const tags = el.tags ?? {};
  if (!isAllowedOsmGroceryElement(tags)) continue;
  const plat = el.lat ?? el.center?.lat;
  const plng = el.lon ?? el.center?.lon;
  if (plat == null || plng == null) continue;
  const name = tags.name!.trim();
  const haystack = haystackFromTags(tags);
  const known = resolveGroceryChainFromHaystack(haystack);
  const distanceMiles = haversineMiles({ lat, lng }, { lat: plat, lng: plng });
  stores.push({
    id: `osm-${el.type}-${el.id}`,
    name,
    chain: known?.displayName ?? tags.brand ?? name,
    addressLine: '',
    city: '',
    state: 'CA',
    zip: '95361',
    lat: plat,
    lng: plng,
    distanceMiles: Math.round(distanceMiles * 100) / 100,
    source: 'osm',
    pricingSource: 'none',
  });
}

const ranked = rankGroceryStores(dedupeGroceryStoresByName(stores));
console.log(`Oakdale 95361 — ${SMART_SHOP_STORES.defaultRadiusMiles} mi — ${ranked.length} stores after filter:\n`);
for (const s of ranked) {
  console.log(`  ${s.distanceMiles?.toFixed(1)} mi  ${s.name} (${s.chain})`);
}
}

void main();
