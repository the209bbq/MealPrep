#!/usr/bin/env node
/**
 * Fetch grocery stores within ~25 mi of Oakdale CA via Overpass and write mobile/data/oakdale-region-stores.json
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../data/oakdale-region-stores.json');

const OAKDALE = { lat: 37.7665, lng: -120.8471 };
const RADIUS_M = Math.round(25 * 1609.34);

const query = `
[out:json][timeout:25];
(
  node["shop"~"supermarket|grocery|convenience"]["name"](around:${RADIUS_M},${OAKDALE.lat},${OAKDALE.lng});
  way["shop"~"supermarket|grocery|convenience"]["name"](around:${RADIUS_M},${OAKDALE.lat},${OAKDALE.lng});
);
out center tags;
`;

const endpoints = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];
let response;
for (const endpoint of endpoints) {
  response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': '209MealPrep/1.0 store-fallback-generator (https://github.com/the209bbq/MealPrep)',
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (response.ok) break;
}
if (!response) {
  console.error('Overpass: no response');
  process.exit(1);
}
if (!response.ok) {
  console.error('Overpass failed', response.status);
  process.exit(1);
}
const json = await response.json();
const elements = json.elements ?? [];

function parseAddress(tags) {
  const housenumber = tags['addr:housenumber'] ?? '';
  const street = tags['addr:street'] ?? tags['addr:place'] ?? '';
  const addressLine = [housenumber, street].filter(Boolean).join(' ').trim() || tags['addr:full'] || '';
  const city = tags['addr:city'] ?? tags['addr:town'] ?? tags['addr:village'] ?? '';
  const state = tags['addr:state'] ?? 'CA';
  const zip = tags['addr:postcode'] ?? '';
  return { addressLine, city, state, zip };
}

const stores = [];
const seen = new Set();
for (const el of elements) {
  const tags = el.tags ?? {};
  const name = tags.name?.trim();
  if (!name) continue;
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) continue;
  const key = `${name.toLowerCase()}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const addr = parseAddress(tags);
  const chain = tags.brand ?? tags.operator ?? name;
  stores.push({
    id: `osm-${el.type}-${el.id}`,
    name,
    chain,
    addressLine: addr.addressLine,
    city: addr.city,
    state: addr.state,
    zip: addr.zip,
    lat,
    lng,
    source: 'osm',
    pricingSource: 'none',
    phone: tags.phone ?? tags['contact:phone'] ?? undefined,
    website: tags.website ?? tags['contact:website'] ?? undefined,
  });
}

stores.sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name));

const payload = {
  attribution:
    'Store locations © OpenStreetMap contributors (ODbL), via Overpass API — snapshot for offline fallback near Oakdale, CA.',
  generatedAt: new Date().toISOString(),
  stores: stores.slice(0, 120),
};

writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${payload.stores.length} stores to ${OUT}`);
