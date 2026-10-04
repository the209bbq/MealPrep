import type { StoreLocation } from '../lib/deals/types';

/**
 * Grocery chains — store locator + weekly ad URLs.
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
   * Prefilled store-locator URL template. Placeholders: {zip}, {city}, {state}, {query}.
   * Only used when the template contains a placeholder (generic locators fall back to Maps).
   */
  storePageUrl?: string;
  /**
   * Regex tested against the full normalized store.website URL.
   * When matched (on an allowed host), Overture website is used as the store page.
   */
  storePagePathPattern?: string;
  /** Optional hostname allowlist (suffix match). When omitted, pattern alone must match. */
  allowedWebsiteHosts?: readonly string[];
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
    storePagePathPattern: '^https://([a-z0-9-]+\\.)?savemart\\.com/stores/.+',
    allowedWebsiteHosts: ['savemart.com'],
    weeklyAdUrl: 'https://www.savemart.com/wp/weekly-ad',
    delivery: { instacartSlug: 'savemart', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'foodmaxx',
    displayName: 'FoodMaxx',
    matchPatterns: ['foodmaxx', 'food maxx'],
    weeklyAdUrl: 'https://www.foodmaxx.com/wp/weekly-ad',
    delivery: { instacartSlug: 'foodmaxx', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'cost_less',
    displayName: 'Cost Less Food Co.',
    matchPatterns: ['cost less', 'costless'],
    weeklyAdUrl: 'https://costlessfoods.com/weekly-ad/',
    delivery: { deliverySearchName: 'Cost Less Foods', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'raleys',
    displayName: "Raley's",
    matchPatterns: ['raley', "raley's", 'raleys', 'bel air', 'nob hill'],
    storePagePathPattern: '^https://([a-z0-9-]+\\.)?raleys\\.com/stores/.+',
    allowedWebsiteHosts: ['raleys.com'],
    weeklyAdUrl: 'https://www.raleys.com/weekly-ad',
    delivery: { instacartSlug: 'raleys', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'safeway',
    displayName: 'Safeway',
    matchPatterns: ['safeway'],
    storePageUrl: 'https://www.safeway.com/store-locator.html?location={zip}',
    storePagePathPattern:
      '^https://((local\\.)?safeway\\.com/.+|([a-z0-9-]+\\.)?safeway\\.com/(?!store-locator)[^?#]+)',
    allowedWebsiteHosts: ['safeway.com'],
    weeklyAdUrl: 'https://www.safeway.com/weeklyad',
    delivery: { instacartSlug: 'safeway', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'albertsons',
    displayName: 'Albertsons',
    matchPatterns: ['albertsons'],
    storePageUrl: 'https://www.albertsons.com/store-locator.html?location={zip}',
    storePagePathPattern: '^https://([a-z0-9-]+\\.)?albertsons\\.com/.+',
    allowedWebsiteHosts: ['albertsons.com'],
    weeklyAdUrl: 'https://www.albertsons.com/weeklyad',
    delivery: { instacartSlug: 'albertsons', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'vons',
    displayName: 'Vons',
    matchPatterns: ['vons'],
    storePageUrl: 'https://www.vons.com/store-locator.html?location={zip}',
    storePagePathPattern: '^https://([a-z0-9-]+\\.)?vons\\.com/.+',
    allowedWebsiteHosts: ['vons.com'],
    weeklyAdUrl: 'https://www.vons.com/weeklyad',
    delivery: { instacartSlug: 'vons', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'pavilions',
    displayName: 'Pavilions',
    matchPatterns: ['pavilions'],
    storePageUrl: 'https://www.pavilions.com/store-locator.html?location={zip}',
    storePagePathPattern: '^https://([a-z0-9-]+\\.)?pavilions\\.com/.+',
    allowedWebsiteHosts: ['pavilions.com'],
    weeklyAdUrl: 'https://www.pavilions.com/weeklyad',
    delivery: { instacartSlug: 'pavilions', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'walmart',
    displayName: 'Walmart',
    matchPatterns: ['walmart supercenter', 'walmart neighborhood', 'neighborhood market', 'walmart'],
    storePageUrl: 'https://www.walmart.com/store/finder?location={zip}',
    storePagePathPattern: '^https://([a-z0-9-]+\\.)?walmart\\.com/store/.+',
    allowedWebsiteHosts: ['walmart.com'],
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
    weeklyAdUrl: 'https://www.wincofoods.com/weekly-ad',
    delivery: { instacart: false, doordash: false, ubereats: true },
  },
  {
    key: 'grocery_outlet',
    displayName: 'Grocery Outlet',
    matchPatterns: ['grocery outlet'],
    storePagePathPattern: '^https://([a-z0-9-]+\\.)?groceryoutlet\\.com/(circulars/storeid/\\d+|stores/.+)',
    allowedWebsiteHosts: ['groceryoutlet.com'],
    weeklyAdUrl: 'https://www.groceryoutlet.com/circulars',
    delivery: { instacartSlug: 'grocery-outlet', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'food_4_less',
    displayName: 'Food 4 Less',
    matchPatterns: ['food 4 less', 'food4less', 'food for less'],
    /** Save Mart–operated NorCal / Central Valley stores (not Kroger’s food4less.com chain). */
    excludeStore: (store) => Boolean(store.krogerLocationId) || store.pricingSource === 'kroger',
    storePagePathPattern: '^https://([a-z0-9-]+\\.)?myfood4less\\.com/.+',
    allowedWebsiteHosts: ['myfood4less.com'],
    weeklyAdUrl: 'https://www.myfood4less.com/store/food4less/pages/weekly-ad',
    delivery: { deliverySearchName: 'Food 4 Less', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'kroger',
    displayName: 'Kroger',
    matchPatterns: ['kroger'],
    storePagePathPattern: '^https://([a-z0-9-]+\\.)?kroger\\.com/stores/.+',
    allowedWebsiteHosts: ['kroger.com'],
    weeklyAdUrl: 'https://www.kroger.com/weeklyad',
    delivery: { instacartSlug: 'kroger', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'fred_meyer',
    displayName: 'Fred Meyer',
    matchPatterns: ['fred meyer', 'fredmeyer'],
    storePagePathPattern: '^https://([a-z0-9-]+\\.)?(fredmeyer|kroger)\\.com/stores/.+',
    allowedWebsiteHosts: ['fredmeyer.com', 'kroger.com'],
    weeklyAdUrl: 'https://www.fredmeyer.com/weeklyad',
    delivery: { instacartSlug: 'fred-meyer', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'king_soopers',
    displayName: 'King Soopers',
    matchPatterns: ['king soopers', 'king sooper'],
    storePagePathPattern: '^https://([a-z0-9-]+\\.)?kingsoopers\\.com/stores/.+',
    allowedWebsiteHosts: ['kingsoopers.com', 'kroger.com'],
    weeklyAdUrl: 'https://www.kingsoopers.com/weeklyad',
    delivery: { instacartSlug: 'king-soopers', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'ralphs',
    displayName: 'Ralphs',
    matchPatterns: ['ralphs'],
    storePagePathPattern: '^https://([a-z0-9-]+\\.)?ralphs\\.com/stores/.+',
    allowedWebsiteHosts: ['ralphs.com', 'kroger.com'],
    weeklyAdUrl: 'https://www.ralphs.com/weeklyad',
    delivery: { instacartSlug: 'ralphs', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'publix',
    displayName: 'Publix',
    matchPatterns: ['publix'],
    storePageUrl: 'https://www.publix.com/locations?search={query}',
    storePagePathPattern: '^https://([a-z0-9-]+\\.)?publix\\.com/locations/.+',
    allowedWebsiteHosts: ['publix.com'],
    weeklyAdUrl: 'https://www.publix.com/savings/weekly-ad',
    delivery: { instacartSlug: 'publix', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'heb',
    displayName: 'H-E-B',
    matchPatterns: ['h-e-b', 'heb'],
    storePageUrl: 'https://www.heb.com/store-locator?q={query}',
    storePagePathPattern: '^https://([a-z0-9-]+\\.)?heb\\.com/.+',
    allowedWebsiteHosts: ['heb.com'],
    weeklyAdUrl: 'https://www.heb.com/h-e-b-ads',
    delivery: { deliverySearchName: 'H-E-B', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'meijer',
    displayName: 'Meijer',
    matchPatterns: ['meijer'],
    storePagePathPattern: '^https://([a-z0-9-]+\\.)?meijer\\.com/.+',
    allowedWebsiteHosts: ['meijer.com'],
    weeklyAdUrl: 'https://www.meijer.com/shopping/weekly-ads.html',
    delivery: { deliverySearchName: 'Meijer', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'wegmans',
    displayName: 'Wegmans',
    matchPatterns: ['wegmans'],
    storePageUrl: 'https://www.wegmans.com/stores?search={query}',
    weeklyAdUrl: 'https://www.wegmans.com/shop/categories/weekly-specials',
    delivery: { deliverySearchName: 'Wegmans', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'hy_vee',
    displayName: 'Hy-Vee',
    matchPatterns: ['hy-vee', 'hy vee', 'hyvee'],
    storePageUrl: 'https://www.hy-vee.com/stores?zip={zip}',
    weeklyAdUrl: 'https://www.hy-vee.com/deals/weekly-ads',
    delivery: { deliverySearchName: 'Hy-Vee', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'food_lion',
    displayName: 'Food Lion',
    matchPatterns: ['food lion'],
    storePagePathPattern: '^https://([a-z0-9-]+\\.)?foodlion\\.com/.+',
    allowedWebsiteHosts: ['foodlion.com'],
    weeklyAdUrl: 'https://www.foodlion.com/weekly-specials/',
    delivery: { deliverySearchName: 'Food Lion', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'stop_and_shop',
    displayName: 'Stop & Shop',
    matchPatterns: ['stop & shop', 'stop and shop'],
    storePageUrl: 'https://www.stopandshop.com/store-locator?location={zip}',
    weeklyAdUrl: 'https://www.stopandshop.com/weeklyad',
    delivery: { instacartSlug: 'stop-shop', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'whole_foods',
    displayName: 'Whole Foods Market',
    matchPatterns: ['whole foods'],
    storePageUrl: 'https://www.wholefoodsmarket.com/stores/search?location={zip}',
    storePagePathPattern: '^https://([a-z0-9-]+\\.)?wholefoodsmarket\\.com/stores/.+',
    allowedWebsiteHosts: ['wholefoodsmarket.com'],
    weeklyAdUrl: 'https://www.wholefoodsmarket.com/sales-flyer',
    delivery: { instacartSlug: 'whole-foods', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'stater_bros',
    displayName: 'Stater Bros.',
    matchPatterns: ['stater bros', 'stater brothers'],
    storePagePathPattern: '^https://([a-z0-9-]+\\.)?staterbros\\.com/stores/.+',
    allowedWebsiteHosts: ['staterbros.com'],
    weeklyAdUrl: 'https://www.staterbros.com/weekly-ad',
    delivery: { deliverySearchName: 'Stater Bros', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'smart_final',
    displayName: 'Smart & Final',
    matchPatterns: ['smart & final', 'smart and final', 'smart final'],
    storePagePathPattern: '^https://([a-z0-9-]+\\.)?smartandfinal\\.com/sm/planning/rsid/\\d+',
    allowedWebsiteHosts: ['smartandfinal.com'],
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
    storePageUrl: 'https://www.sprouts.com/stores?zip={zip}',
    storePagePathPattern: '^https://([a-z0-9-]+\\.)?sprouts\\.com/stores/.+',
    allowedWebsiteHosts: ['sprouts.com'],
    weeklyAdUrl: 'https://www.sprouts.com/weekly-ad',
    delivery: { instacartSlug: 'sprouts', instacart: true, doordash: true, ubereats: true },
  },
  {
    key: 'aldi',
    displayName: 'Aldi',
    matchPatterns: ['aldi'],
    storePageUrl: 'https://www.aldi.us/stores?zip={zip}',
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
