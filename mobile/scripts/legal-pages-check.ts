import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import appJson from '../app.json';
import { GITHUB_PAGES_APP_PATH, githubPagesLegalUrl } from '../config/legalPages.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const publicDir = path.join(mobileRoot, 'public');

const baseUrl = appJson.expo?.experiments?.baseUrl ?? '';
const normalized = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
assert.equal(GITHUB_PAGES_APP_PATH, normalized);

for (const file of ['privacy.html', 'terms.html']) {
  const full = path.join(publicDir, file);
  assert.ok(fs.existsSync(full), `missing public/${file}`);
  const html = fs.readFileSync(full, 'utf8');
  assert.ok(html.includes('davidjones21354@gmail.com'), `${file} should list contact email`);
}

assert.equal(githubPagesLegalUrl('privacy'), `https://the209bbq.github.io${normalized}/privacy`);

console.log('legal-pages-check: ok');
