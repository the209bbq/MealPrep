/**
 * Manual check: curl resolved store-page and weekly-ad URLs.
 * Fails on HTTP 404 or a not-found page title. 403 bot blocks are OK.
 *
 * Run from mobile/: npm run check:store-links
 */

import { execFileSync } from 'node:child_process';
import { STORE_CHAINS } from '../config/storeChains';
import { resolveStorePageUrl, resolveWeeklyAdLink } from '../lib/stores/storeLinks';
import { STORE_LINK_FALLBACK_ZIP, STORE_LINK_SAMPLE_STORES } from '../lib/stores/storeLinkFixtures';

const UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

const NOT_FOUND_TITLE_RE = /\b(404|not\s*found|page\s*not\s*found)\b/i;

type UrlCheck = { label: string; url: string };

function sampleTemplateUrl(template: string, zip: string, query: string): string {
  return template
    .replace(/\{zip\}/g, zip)
    .replace(/\{city\}/g, 'Springfield')
    .replace(/\{state\}/g, 'IL')
    .replace(/\{query\}/g, encodeURIComponent(query));
}

function collectTemplateUrls(): UrlCheck[] {
  const out: UrlCheck[] = [];
  const zips = ['95361', '78701', '14618'];
  const query = 'Grocery Springfield IL 62701';
  for (const chain of STORE_CHAINS) {
    if (!chain.storePageUrl || !/\{(zip|city|state|query)\}/.test(chain.storePageUrl)) continue;
    for (const zip of zips) {
      out.push({
        label: `${chain.key} locator (zip ${zip})`,
        url: sampleTemplateUrl(chain.storePageUrl, zip, query),
      });
    }
  }
  for (const chain of STORE_CHAINS) {
    if (chain.weeklyAdUrl) {
      out.push({ label: `${chain.key} weekly`, url: chain.weeklyAdUrl });
    }
  }
  return out;
}

function collectResolvedSampleUrls(): UrlCheck[] {
  const out: UrlCheck[] = [];
  for (const store of STORE_LINK_SAMPLE_STORES) {
    const url = resolveStorePageUrl(store, { fallbackZip: STORE_LINK_FALLBACK_ZIP });
    out.push({ label: `resolved ${store.id}`, url });
    const weekly = resolveWeeklyAdLink(store);
    if (weekly) {
      out.push({ label: `weekly ${store.id}`, url: weekly.url });
    }
  }
  return out;
}

function curlStatusAndTitle(url: string): { status: number; title: string } {
  let status = 0;
  try {
    status = Number(
      execFileSync('curl', ['-sL', '-A', UA, '-o', '/dev/null', '-w', '%{http_code}', url], {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
      }).trim(),
    );
  } catch {
    status = 0;
  }
  let title = '';
  try {
    const html = execFileSync('curl', ['-sL', '-A', UA, url], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    const m = html.match(/<title[^>]*>([^<]+)/i);
    title = m?.[1]?.trim() ?? '';
  } catch {
    title = '';
  }
  return { status, title };
}

const seen = new Set<string>();
const checks = [...collectTemplateUrls(), ...collectResolvedSampleUrls()].filter(({ url }) => {
  if (seen.has(url)) return false;
  seen.add(url);
  return true;
});

const failures: string[] = [];

for (const { label, url } of checks) {
  const { status, title } = curlStatusAndTitle(url);
  if (status === 404) {
    failures.push(`${label}: HTTP 404 — ${url}`);
    continue;
  }
  if (status === 403 || status === 0) {
    console.log(`${label}: HTTP ${status || 'blocked'} (bot block OK) — ${url}`);
    continue;
  }
  if (status < 200 || status >= 400) {
    failures.push(`${label}: HTTP ${status} — ${url}`);
    continue;
  }
  if (title && NOT_FOUND_TITLE_RE.test(title)) {
    failures.push(`${label}: not-found title "${title}" — ${url}`);
    continue;
  }
  console.log(`${label}: OK (${status})${title ? ` — ${title.slice(0, 72)}` : ''}`);
}

if (failures.length) {
  console.error('\ncheck-store-links failed:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}

console.log('\ncheck-store-links: ok');
