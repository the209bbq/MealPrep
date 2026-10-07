import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const swSource = fs.readFileSync(path.join(mobileRoot, 'public/sw.js'), 'utf8');
const exportScript = fs.readFileSync(
  path.join(mobileRoot, 'scripts/apply-pwa-export.mjs'),
  'utf8',
);

assert.match(swSource, /NAV_POLICY_VERSION = '5'/);
assert.match(swSource, /function cacheFirst\(/);
assert.match(swSource, /function staleWhileRevalidate\(/);
assert.match(swSource, /isImmutableHashedAsset/);
assert.doesNotMatch(swSource, /function networkFirst\(/);
assert.match(swSource, /cacheFirst\(request\)/);
assert.doesNotMatch(swSource, /cache\.addAll\(/);
assert.match(swSource, /PRECACHE_URLS\.map\(\(url\) => precacheUrl\(url\)\)/);

assert.match(exportScript, /shouldPrecacheExpoStatic/);
assert.match(exportScript, /heic2any/);
assert.match(exportScript, /shouldPrecacheHtml/);
assert.doesNotMatch(
  exportScript,
  /for \(const route of ROUTE_NAMES\)[\s\S]*urls\.add\(toPublicUrl\(`\$\{route\}\/index\.html`\)\)/,
  'route HTML shells should not be precached',
);

console.log('pwa-sw-check: ok');
