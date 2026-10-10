import type { StoreLocation } from '../lib/deals/types';

export type WeeklyAdButtonLabel = "See this week's ad" | 'See specials' | 'See deals';

export interface WeeklyAdChainConfig {
  /** Normalized key shared with community deals (`store_deals.store_key`). */
  key: string;
  displayName: string;
  /** Case-insensitive substring patterns matched against store name + chain. */
  matchPatterns: string[];
  url: string;
  buttonLabel?: WeeklyAdButtonLabel;
  /** When true, skip this chain (e.g. Kroger-operated Food 4 Less vs independent NorCal). */
  excludeStore?: (store: Pick<StoreLocation, 'name' | 'chain' | 'krogerLocationId' | 'pricingSource'>) => boolean;
}

export const WEEKLY_AD_CHAINS: readonly WeeklyAdChainConfig[] = [
  {
    key: 'cost_less',
    displayName: 'Cost Less Food Co.',
    matchPatterns: ['cost less', 'costless'],
    url: 'https://costlessfoods.com/weekly-ad/',
  },
  {
    key: 'save_mart',
    displayName: 'Save Mart',
    matchPatterns: ['save mart', 'savemart'],
    url: 'https://savemart.com/flyers',
  },
  {
    key: 'foodmaxx',
    displayName: 'FoodMaxx',
    matchPatterns: ['foodmaxx', 'food maxx'],
    url: 'https://foodmaxx.com/flyers',
  },
  {
    key: 'grocery_outlet',
    displayName: 'Grocery Outlet',
    matchPatterns: ['grocery outlet'],
    url: 'https://www.groceryoutlet.com/circulars',
  },
  {
    key: 'safeway',
    displayName: 'Safeway',
    matchPatterns: ['safeway'],
    url: 'https://www.safeway.com/weeklyad',
  },
  {
    key: 'raleys',
    displayName: "Raley's",
    matchPatterns: ['raley', "raley's", 'raleys'],
    url: 'https://www.raleys.com/weekly-ad',
  },
  {
    key: 'target',
    displayName: 'Target',
    matchPatterns: ['target'],
    url: 'https://www.target.com/weekly-ad',
  },
  {
    key: 'winco',
    displayName: 'WinCo',
    matchPatterns: ['winco'],
    url: 'https://www.wincofoods.com/weekly-ad',
    buttonLabel: 'See specials',
  },
  {
    key: 'walmart',
    displayName: 'Walmart',
    matchPatterns: ['walmart'],
    url: 'https://www.walmart.com/shop/deals',
    buttonLabel: 'See deals',
  },
  {
    key: 'food_4_less_norcal',
    displayName: 'Food 4 Less',
    matchPatterns: ['food 4 less', 'food4less', 'food for less'],
    url: 'https://www.myfood4less.com',
    excludeStore: (store) =>
      Boolean(store.krogerLocationId) || store.pricingSource === 'kroger' || /kroger/i.test(store.chain),
  },
] as const;

function haystackForStore(store: Pick<StoreLocation, 'name' | 'chain'>): string {
  return `${store.name} ${store.chain}`.toLowerCase();
}

export function resolveWeeklyAdChain(
  store: Pick<StoreLocation, 'name' | 'chain' | 'krogerLocationId' | 'pricingSource'>,
): WeeklyAdChainConfig | null {
  const haystack = haystackForStore(store);
  for (const chain of WEEKLY_AD_CHAINS) {
    if (chain.excludeStore?.(store)) continue;
    const hit = chain.matchPatterns.some((pattern) => haystack.includes(pattern.toLowerCase()));
    if (hit) return chain;
  }
  return null;
}

export function resolveStoreChainKey(
  store: Pick<StoreLocation, 'name' | 'chain' | 'krogerLocationId' | 'pricingSource'>,
): string | null {
  return resolveWeeklyAdChain(store)?.key ?? null;
}

export function weeklyAdButtonLabel(chain: WeeklyAdChainConfig): WeeklyAdButtonLabel {
  return chain.buttonLabel ?? "See this week's ad";
}
