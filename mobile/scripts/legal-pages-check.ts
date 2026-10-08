import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import appJson from '../app.json';
import {
  GITHUB_PAGES_APP_PATH,
  githubPagesAccountDeletionUrl,
  githubPagesLegalUrl,
} from '../config/legalPages.ts';
import { SUPPORT_EMAIL } from '../config/support.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const publicDir = path.join(mobileRoot, 'public');

const baseUrl = appJson.expo?.experiments?.baseUrl ?? '';
const normalized = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
assert.equal(GITHUB_PAGES_APP_PATH, normalized);

const deletionUrl = githubPagesAccountDeletionUrl();

for (const file of ['privacy.html', 'terms.html']) {
  const full = path.join(publicDir, file);
  assert.ok(fs.existsSync(full), `missing public/${file}`);
  const html = fs.readFileSync(full, 'utf8');
  assert.ok(!html.includes('Template notice'), `${file} should not contain template notice`);
  assert.ok(html.includes(SUPPORT_EMAIL), `${file} should list support contact`);
  assert.ok(!html.includes('davidjones21354@gmail.com'), `${file} should not list old personal email`);
}

const privacyHtml = fs.readFileSync(path.join(publicDir, 'privacy.html'), 'utf8');
assert.ok(privacyHtml.includes(deletionUrl), 'privacy.html should link to web account deletion page');

assert.equal(githubPagesLegalUrl('privacy'), `https://mealplanatic.app${normalized}/privacy`);

console.log('legal-pages-check: ok');
