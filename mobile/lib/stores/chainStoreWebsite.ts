import type { StoreChainConfig } from '../../config/storeChains';
import type { StoreLocation } from '../deals/types';

const BLOCKED_WEBSITE_HOST_RE =
  /(^|\.)((google|goo\.gl|facebook|fb\.com|yelp|instagram|tripadvisor|foursquare|bing|apple|maps\.app)|openstreetmap)\./i;

const GENERIC_PATH_SKIP_RE = /\/(weekly-ad|circular|careers|about|privacy|terms|contact|login|signup)(\/|$)/i;

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'market',
  'markets',
  'foods',
  'food',
  'supermarket',
  'grocery',
  'store',
  'stores',
  'company',
  'co',
]);

export function normalizeStoreWebsite(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/\//, '')}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return '';
  }
}

export function isBlockedStoreWebsiteHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (!h) return true;
  if (BLOCKED_WEBSITE_HOST_RE.test(h)) return true;
  return false;
}

function chainNameTokens(chainOrName: string): string[] {
  return chainOrName
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t))
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

function hostMatchesChainName(hostname: string, chainOrName: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  const tokens = chainNameTokens(chainOrName);
  if (tokens.length === 0) return false;
  const compactHost = host.replace(/[^a-z0-9]/g, '');
  return tokens.some((token) => {
    const compact = token.replace(/[^a-z0-9]/g, '');
    return compact.length >= 3 && compactHost.includes(compact);
  });
}

export function isStoreSpecificWebsitePath(pathname: string): boolean {
  const path = pathname || '/';
  if (path === '/' || path === '') return false;
  const lower = path.toLowerCase();
  if (GENERIC_PATH_SKIP_RE.test(lower)) return false;
  if (/\/stores?\/details?\//i.test(lower)) return true;
  if (/\/stores?\/.+/i.test(lower) && !/\/stores?\/?$/i.test(lower)) return true;
  if (/\/locations?\/\d+/i.test(lower)) return true;
  if (/\/locations?\/.+\/.+/i.test(lower)) return true;
  if (/\/circulars\/storeid\/\d+/i.test(lower)) return true;
  if (/\/sm\/planning\/rsid\/\d+/i.test(lower)) return true;
  if (/\/store\/\d+/i.test(lower)) return true;
  const segments = lower.split('/').filter(Boolean);
  return segments.length >= 2;
}

function hostAllowed(hostname: string, allowedHosts: readonly string[]): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, '');
  return allowedHosts.some((allowed) => {
    const a = allowed.toLowerCase().replace(/^www\./, '');
    return h === a || h.endsWith(`.${a}`);
  });
}

export function matchesConfiguredChainStorePage(chain: StoreChainConfig, url: string): boolean {
  if (!chain.storePagePathPattern) return false;
  if (!new RegExp(chain.storePagePathPattern, 'i').test(url)) return false;
  const host = hostnameOf(url);
  if (isBlockedStoreWebsiteHost(host)) return false;
  if (chain.allowedWebsiteHosts?.length && !hostAllowed(host, chain.allowedWebsiteHosts)) return false;
  return isStoreSpecificWebsitePath(pathnameOf(url));
}

export function matchesGenericChainStorePage(
  store: Pick<StoreLocation, 'name' | 'chain'>,
  url: string,
): boolean {
  const host = hostnameOf(url);
  if (isBlockedStoreWebsiteHost(host)) return false;
  const label = store.chain?.trim() || store.name?.trim() || '';
  if (!label) return false;
  if (!hostMatchesChainName(host, label)) return false;
  return isStoreSpecificWebsitePath(pathnameOf(url));
}

export function resolveExactStoreWebsiteUrl(
  store: Pick<StoreLocation, 'name' | 'chain' | 'website'>,
  chain: StoreChainConfig | null,
): string | null {
  const normalized = store.website ? normalizeStoreWebsite(store.website) : null;
  if (!normalized) return null;

  if (chain) {
    if (chain.storePagePathPattern && matchesConfiguredChainStorePage(chain, normalized)) {
      return normalized;
    }
    return null;
  }

  if (matchesGenericChainStorePage(store, normalized)) return normalized;
  return null;
}
