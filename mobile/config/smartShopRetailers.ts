/**
 * In-store / online retailer search URLs (no scraping, no invented prices).
 * Future Walmart affiliate API can extend RetailerShoppingConfig.apiPartnerId.
 */

export type RetailerId = 'walmart' | 'target';

export interface RetailerShoppingConfig {
  retailerId: RetailerId;
  /** Matches GroceryChainConfig.key in smartShopChains.ts */
  chainKey: string;
  displayName: string;
  brandWikidata: string;
  /** OSM `brand` tag values (case-insensitive). */
  osmBrandNames: readonly string[];
  /** Extra name/brand substrings when wikidata is missing. */
  nameMatchPatterns: readonly string[];
  itemSearchTemplate: string;
  /** Fallback when the combined list query would be too long. */
  listBrowseUrl: string;
  /** Max characters for a single combined search query. */
  maxCombinedSearchChars: number;
  /** Reserved for a future affiliate / product API integration. */
  apiPartnerId?: string;
}

export const RETAILER_SHOPPING: readonly RetailerShoppingConfig[] = [
  {
    retailerId: 'walmart',
    chainKey: 'walmart',
    displayName: 'Walmart',
    brandWikidata: 'Q483551',
    osmBrandNames: ['Walmart', 'Walmart Supercenter', 'Walmart Neighborhood Market'],
    nameMatchPatterns: ['walmart supercenter', 'walmart neighborhood', 'neighborhood market', 'walmart'],
    itemSearchTemplate: 'https://www.walmart.com/search?q={query}',
    listBrowseUrl: 'https://www.walmart.com/browse/food/976759',
    maxCombinedSearchChars: 180,
  },
  {
    retailerId: 'target',
    chainKey: 'target',
    displayName: 'Target',
    brandWikidata: 'Q1046951',
    osmBrandNames: ['Target'],
    nameMatchPatterns: ['target'],
    itemSearchTemplate: 'https://www.target.com/s?searchTerm={query}',
    listBrowseUrl: 'https://www.target.com/c/grocery/-/N-5xt1a',
    maxCombinedSearchChars: 180,
  },
] as const;

/** Wikidata QIDs used in lean Overpass clauses for big-box grocers. */
export const RETAILER_OSM_WIKIDATA_IDS: readonly string[] = RETAILER_SHOPPING.map((r) => r.brandWikidata);

export function retailerConfigByChainKey(chainKey: string): RetailerShoppingConfig | undefined {
  return RETAILER_SHOPPING.find((r) => r.chainKey === chainKey);
}

export function retailerConfigById(id: RetailerId): RetailerShoppingConfig {
  const found = RETAILER_SHOPPING.find((r) => r.retailerId === id);
  if (!found) throw new Error(`Unknown retailer: ${id}`);
  return found;
}
