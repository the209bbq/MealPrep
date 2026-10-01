import { GROCERY_CHAINS } from '../../config/smartShopChains';
import {
  type RetailerShoppingConfig,
  RETAILER_SHOPPING,
  retailerConfigByChainKey,
} from '../../config/smartShopRetailers';
import type { StoreLocation } from '../deals/types';
import { formatGroceryListPlainText } from './deliveryLinks';

function haystack(store: Pick<StoreLocation, 'name' | 'chain'>): string {
  return `${store.name} ${store.chain}`.toLowerCase();
}

function resolveChainKey(store: Pick<StoreLocation, 'name' | 'chain'>): string | null {
  const h = haystack(store);
  for (const chain of GROCERY_CHAINS) {
    if (chain.matchPatterns.some((p) => h.includes(p.toLowerCase()))) return chain.key;
  }
  return null;
}

export function resolveRetailerForStore(
  store: Pick<StoreLocation, 'name' | 'chain'>,
): RetailerShoppingConfig | null {
  const key = resolveChainKey(store);
  if (!key) return null;
  return retailerConfigByChainKey(key) ?? null;
}

export function fillRetailerTemplate(template: string, query: string): string {
  return template.replace('{query}', encodeURIComponent(query.trim()));
}

export function retailerItemSearchUrl(retailer: RetailerShoppingConfig, itemName: string): string {
  return fillRetailerTemplate(retailer.itemSearchTemplate, itemName);
}

export function buildCombinedListSearchQuery(
  items: ReadonlyArray<{ name: string }>,
  maxChars: number,
): string {
  const names = items.map((i) => i.name.trim()).filter(Boolean);
  if (names.length === 0) return '';
  let combined = names[0];
  for (let i = 1; i < names.length; i++) {
    const next = `${combined} ${names[i]}`;
    if (next.length > maxChars) break;
    combined = next;
  }
  return combined;
}

/** One search URL for the whole list when it fits; otherwise the retailer's grocery browse URL. */
export function retailerWholeListSearchUrl(
  retailer: RetailerShoppingConfig,
  items: ReadonlyArray<{ name: string }>,
): string {
  const combined = buildCombinedListSearchQuery(items, retailer.maxCombinedSearchChars);
  if (!combined) return retailer.listBrowseUrl;
  if (combined.length <= retailer.maxCombinedSearchChars && items.length > 0) {
    return fillRetailerTemplate(retailer.itemSearchTemplate, combined);
  }
  return retailer.listBrowseUrl;
}

export function formatRetailerListClipboard(
  items: ReadonlyArray<{ name: string; quantity: number; unit: string }>,
): string {
  return formatGroceryListPlainText(items);
}

export function retailerShopOnSiteLabel(retailer: RetailerShoppingConfig): string {
  return `Shop on ${retailer.displayName}`;
}

export function retailerItemSearchLabel(retailer: RetailerShoppingConfig, itemName: string): string {
  const short = itemName.length > 28 ? `${itemName.slice(0, 25)}…` : itemName;
  return `Find “${short}” on ${retailer.displayName}`;
}

export function retailerWholeListLabel(retailer: RetailerShoppingConfig): string {
  return `Shop whole list on ${retailer.displayName}`;
}

/** Exported for tests — OSM tag matching for department_store / general. */
export function osmTagsMatchRetailer(
  tags: Record<string, string>,
  retailer: RetailerShoppingConfig = RETAILER_SHOPPING[0],
): boolean {
  const wikidata = tags['brand:wikidata'] ?? tags.wikidata;
  if (wikidata === retailer.brandWikidata) return true;
  const brand = (tags.brand ?? '').toLowerCase();
  if (brand && retailer.osmBrandNames.some((b) => brand === b.toLowerCase())) return true;
  const haystack = [tags.name, tags.brand, tags.operator].filter(Boolean).join(' ').toLowerCase();
  return retailer.nameMatchPatterns.some((p) => haystack.includes(p.toLowerCase()));
}

export function osmTagsMatchAnyRetailerGrocery(tags: Record<string, string>): boolean {
  return RETAILER_SHOPPING.some((r) => osmTagsMatchRetailer(tags, r));
}
