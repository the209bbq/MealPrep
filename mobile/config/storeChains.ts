import type { StoreLocation } from '../lib/deals/types';

/**
 * Grocery chains near Oakdale / Modesto / Riverbank / Escalon — store locator + weekly ad URLs.
 * Weekly-ad links are dateless landing pages that always show the current flyer.
 */

export type StoreChainDeliveryAvailability = {
  instacart?: boolean;
  doordash?: boolean;
  ubereats?: boolean;
  /** Instacart /store/{slug} when known. */
  instacartSlug?: string;
  /** Search label for delivery deep links. */
  deliverySearchName?: string;
};

export interface StoreChainConfig {
  key: string;
  displayName: string;
  matchPatterns: readonly string[];
  /**
   * Store-locator URL template. Placeholders: {zip}, {city}, {state}, {query}.
   * {query} is a URL-encoded "chain + address" search string.
   */
  storePageUrl?: string;
  weeklyAdUrl?: string;
  /** When true, weekly ad is hosted off the primary domain (labeled in UI). */
  weeklyAdIsThirdParty?: boolean;
  excludeStore?: (store: Pick<StoreLocation, 'name' | 'chain' | 'krogerLocationId' | 'pricingSource'>) => boolean;
  delivery?: StoreChainDeliveryAvailability;
}

export const STORE_CHAINS: readonly StoreChainConfig[] = [
  {
    key: 'save_mart',
    displayName: 'Save Mart',
    matchPatterns: ['save mart', 'savemart'],
    storePageUrl: 'https://www.savemart.com/stores/?showStoreLocator=true',
    weeklyAdUrl: 'https://www.savemart.com/wp/weekly-ad',
    delivery: { instacartSlug: 'savemart', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'foodmaxx',
    displayName: 'FoodMaxx',
    matchPatterns: ['foodmaxx', 'food maxx'],
    storePageUrl: 'https://www.foodmaxx.com/store-locator',
    weeklyAdUrl: 'https://www.foodmaxx.com/wp/weekly-ad',
    delivery: { instacartSlug: 'foodmaxx', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'cost_less',
    displayName: 'Cost Less Food Co.',
    matchPatterns: ['cost less', 'costless'],
    storePageUrl: 'https://www.costlessfoods.com/locations',
    weeklyAdUrl: 'https://costlessfoods.com/weekly-ad/',
    delivery: { deliverySearchName: 'Cost Less Foods', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'raleys',
    displayName: "Raley's",
    matchPatterns: ['raley', "raley's", 'raleys', 'bel air', 'nob hill'],
    storePageUrl: 'https://www.raleys.com/stores',
    weeklyAdUrl: 'https://www.raleys.com/weekly-ad',
    delivery: { instacartSlug: 'raleys', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'safeway',
    displayName: 'Safeway',
    matchPatterns: ['safeway'],
    storePageUrl: 'https://www.safeway.com/find-store.html?q={query}',
    weeklyAdUrl: 'https://www.safeway.com/weeklyad',
    delivery: { instacartSlug: 'safeway', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'walmart',
    displayName: 'Walmart',
    matchPatterns: ['walmart supercenter', 'walmart neighborhood', 'neighborhood market', 'walmart'],
    storePageUrl: 'https://www.walmart.com/store/finder?location={zip}',
    weeklyAdUrl: 'https://www.walmart.com/shop/deals',
    delivery: { deliverySearchName: 'Walmart', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'target',
    displayName: 'Target',
    matchPatterns: ['target'],
    storePageUrl: 'https://www.target.com/store-locator/find-stores?address={zip}',
    weeklyAdUrl: 'https://www.target.com/weekly-ad',
    delivery: { deliverySearchName: 'Target', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'winco',
    displayName: 'WinCo',
    matchPatterns: ['winco', 'winco foods'],
    storePageUrl: 'https://www.wincofoods.com/store-locator',
    weeklyAdUrl: 'https://www.wincofoods.com/weekly-ad',
    delivery: { instacart: false, doordash: false, ubereats: true },
  },
  {
    key: 'grocery_outlet',
    displayName: 'Grocery Outlet',
    matchPatterns: ['grocery outlet'],
    storePageUrl: 'https://www.groceryoutlet.com/store-locator',
    weeklyAdUrl: 'https://www.groceryoutlet.com/circulars',
    delivery: { instacartSlug: 'grocery-outlet', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'food_4_less',
    displayName: 'Food 4 Less',
    matchPatterns: ['food 4 less', 'food4less', 'food for less'],
    /** Save Mart–operated NorCal / Central Valley stores (not Kroger’s food4less.com chain). */
    storePageUrl: 'https://www.myfood4less.com/store/food4less/pages/locations',
    weeklyAdUrl: 'https://www.myfood4less.com/store/food4less/pages/weekly-ad',
    delivery: { deliverySearchName: 'Food 4 Less', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'smart_final',
    displayName: 'Smart & Final',
    matchPatterns: ['smart & final', 'smart and final', 'smart final'],
    weeklyAdUrl: 'https://www.smartandfinal.com/circular',
    delivery: { instacartSlug: 'smart-and-final', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'costco',
    displayName: 'Costco',
    matchPatterns: ['costco'],
    storePageUrl: 'https://www.costco.com/warehouse-locations?search={query}',
    weeklyAdUrl: 'https://www.costco.com/warehouse-savings.html',
    delivery: { instacartSlug: 'costco', instacart: true, doordash: false, ubereats: true },
  },
  {
    key: 'trader_joes',
    displayName: "Trader Joe's",
    matchPatterns: ['trader joe', "trader joe's", 'trader joes'],
    storePageUrl: 'https://locations.traderjoes.com/?q={query}',
    weeklyAdUrl: 'https://www.traderjoes.com/home/flyer',
    delivery: { instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'sprouts',
    displayName: 'Sprouts',
    matchPatterns: ['sprouts'],
    storePageUrl: 'https://www.sprouts.com/stores',
    weeklyAdUrl: 'https://www.sprouts.com/weekly-ad',
    delivery: { instacartSlug: 'sprouts', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'aldi',
    displayName: 'Aldi',
    matchPatterns: ['aldi'],
    storePageUrl: 'https://www.aldi.us/stores',
    weeklyAdUrl: 'https://www.aldi.us/weekly-specials',
    delivery: { instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'dollar_general',
    displayName: 'Dollar General',
    matchPatterns: ['dollar general'],
    storePageUrl: 'https://www.dollargeneral.com/store-locator?q={query}',
    weeklyAdUrl: 'https://www.dollargeneral.com/deals/weekly-ads',
    delivery: { instacart: false, doordash: true, ubereats: false },
  },
] as const;

function haystackForStore(store: Pick<StoreLocation, 'name' | 'chain'>): string {
  return `${store.name} ${store.chain}`.toLowerCase();
}

export function resolveStoreChainConfig(
  store: Pick<StoreLocation, 'name' | 'chain' | 'krogerLocationId' | 'pricingSource'>,
): StoreChainConfig | null {
  const haystack = haystackForStore(store);
  for (const chain of STORE_CHAINS) {
    if (chain.excludeStore?.(store)) continue;
    if (chain.matchPatterns.some((p) => haystack.includes(p.toLowerCase()))) return chain;
  }
  return null;
}

/** Chains with a verified dateless weekly-ad landing page (for PR notes). */
export const VERIFIED_WEEKLY_AD_CHAIN_KEYS: readonly string[] = STORE_CHAINS.filter((c) =>
  Boolean(c.weeklyAdUrl),
).map((c) => c.key);
