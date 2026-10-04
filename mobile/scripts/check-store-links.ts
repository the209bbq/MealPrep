/**
 * Manual check: curl chain store-locator and weekly-ad URLs from storeChains.ts.
 * Fails on HTTP 404 or a not-found page title. 403 bot blocks are OK.
 *
 * Run from mobile/: npm run check:store-links
 */

import { execFileSync } from 'node:child_process';
import { STORE_CHAINS } from '../config/storeChains';

const UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

const NOT_FOUND_TITLE_RE = /\b(404|not\s*found|page\s*not\s*found)\b/i;

type UrlCheck = { chainKey: string; kind: 'store' | 'weekly'; url: string };

function sampleUrl(template: string): string {
  return template
    .replace(/\{zip\}/g, '95361')
    .replace(/\{city\}/g, 'Oakdale')
    .replace(/\{state\}/g, 'CA')
    .replace(/\{query\}/g, encodeURIComponent('Safeway Oakdale CA 95361'));
}

function collectUrls(): UrlCheck[] {
  const out: UrlCheck[] = [];
  for (const chain of STORE_CHAINS) {
    if (chain.storePageUrl) {
      out.push({ chainKey: chain.key, kind: 'store', url: sampleUrl(chain.storePageUrl) });
    }
    if (chain.weeklyAdUrl) {
      out.push({ chainKey: chain.key, kind: 'weekly', url: chain.weeklyAdUrl });
    }
  }
  return out;
}

function curlStatusAndTitle(url: string): { status: number; title: string } {
  const status = Number(
    execFileSync('curl', ['-sL', '-A', UA, '-o', '/dev/null', '-w', '%{http_code}', url], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    }).trim(),
  );
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

const failures: string[] = [];

for (const { chainKey, kind, url } of collectUrls()) {
  const { status, title } = curlStatusAndTitle(url);
  const label = `${chainKey} (${kind})`;
  if (status === 404) {
    failures.push(`${label}: HTTP 404 — ${url}`);
    continue;
  }
  if (status === 403) {
    console.log(`${label}: HTTP 403 (bot block OK) — ${url}`);
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
