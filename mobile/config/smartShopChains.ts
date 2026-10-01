/**
 * Grocery chain allowlist, delivery availability, and URL slugs.
 * HTTP checks from datacenters often return 401/403; templates match in-app deep links.
 */

export type DeliveryServiceId = 'instacart' | 'doordash';

export interface ChainDeliveryConfig {
  /** Instacart store path slug (https://www.instacart.com/store/{slug}). */
  instacartSlug?: string;
  instacartAvailable?: boolean;
  doordashAvailable?: boolean;
  /** Override search label when slug is missing. */
  deliverySearchName?: string;
}

export interface GroceryChainConfig {
  key: string;
  displayName: string;
  /** Case-insensitive substrings matched against name + brand + operator. */
  matchPatterns: readonly string[];
  /** Subtract from sort distance (miles) so known chains rise slightly. */
  distanceBoostMiles: number;
  /** Allow shop=wholesale when name matches (Costco, Sam's, WinCo). */
  wholesaleClub?: boolean;
  delivery?: ChainDeliveryConfig;
}

export const GROCERY_CHAINS: readonly GroceryChainConfig[] = [
  {
    key: 'save_mart',
    displayName: 'Save Mart',
    matchPatterns: ['save mart', 'savemart'],
    distanceBoostMiles: 0.35,
    delivery: { instacartSlug: 'savemart', instacartAvailable: true, doordashAvailable: true },
  },
  {
    key: 'foodmaxx',
    displayName: 'FoodMaxx',
    matchPatterns: ['foodmaxx', 'food maxx'],
    distanceBoostMiles: 0.35,
    delivery: { instacartSlug: 'foodmaxx', instacartAvailable: true, doordashAvailable: true },
  },
  {
    key: 'cost_less',
    displayName: 'Cost Less Food Co',
    matchPatterns: ['cost less', 'costless'],
    distanceBoostMiles: 0.3,
    delivery: { instacartAvailable: true, doordashAvailable: true, deliverySearchName: 'Cost Less Foods' },
  },
  {
    key: 'grocery_outlet',
    displayName: 'Grocery Outlet',
    matchPatterns: ['grocery outlet'],
    distanceBoostMiles: 0.35,
    delivery: { instacartSlug: 'grocery-outlet', instacartAvailable: true, doordashAvailable: true },
  },
  {
    key: 'winco',
    displayName: 'WinCo',
    matchPatterns: ['winco', 'winco foods'],
    distanceBoostMiles: 0.35,
    wholesaleClub: true,
    delivery: { instacartAvailable: true, doordashAvailable: true },
  },
  {
    key: 'safeway',
    displayName: 'Safeway',
    matchPatterns: ['safeway'],
    distanceBoostMiles: 0.35,
    delivery: { instacartSlug: 'safeway', instacartAvailable: true, doordashAvailable: true },
  },
  {
    key: 'raleys',
    displayName: "Raley's",
    matchPatterns: ['raley', "raley's", 'raleys', 'bel air', 'nob hill'],
    distanceBoostMiles: 0.35,
    delivery: { instacartSlug: 'raleys', instacartAvailable: true, doordashAvailable: true },
  },
  {
    key: 'walmart',
    displayName: 'Walmart',
    matchPatterns: ['walmart supercenter', 'walmart neighborhood', 'neighborhood market', 'walmart'],
    distanceBoostMiles: 0.25,
    delivery: { instacartAvailable: true, doordashAvailable: true, deliverySearchName: 'Walmart' },
  },
  {
    key: 'target',
    displayName: 'Target',
    matchPatterns: ['target'],
    distanceBoostMiles: 0.2,
    delivery: { instacartAvailable: true, doordashAvailable: true },
  },
  {
    key: 'food_4_less',
    displayName: 'Food 4 Less',
    matchPatterns: ['food 4 less', 'food4less', 'food for less'],
    distanceBoostMiles: 0.3,
    delivery: { instacartAvailable: true, doordashAvailable: true },
  },
  {
    key: 'costco',
    displayName: 'Costco',
    matchPatterns: ['costco'],
    distanceBoostMiles: 0.35,
    wholesaleClub: true,
    delivery: { instacartSlug: 'costco', instacartAvailable: true, doordashAvailable: true },
  },
  {
    key: 'trader_joes',
    displayName: "Trader Joe's",
    matchPatterns: ['trader joe', "trader joe's", 'trader joes'],
    distanceBoostMiles: 0.3,
    delivery: { instacartAvailable: true, doordashAvailable: true },
  },
  {
    key: 'sprouts',
    displayName: 'Sprouts',
    matchPatterns: ['sprouts'],
    distanceBoostMiles: 0.3,
    delivery: { instacartSlug: 'sprouts', instacartAvailable: true, doordashAvailable: true },
  },
  {
    key: 'smart_final',
    displayName: 'Smart & Final',
    matchPatterns: ['smart & final', 'smart and final', 'smart final'],
    distanceBoostMiles: 0.3,
    delivery: { instacartSlug: 'smart-and-final', instacartAvailable: true, doordashAvailable: true },
  },
  {
    key: 'el_super',
    displayName: 'El Super',
    matchPatterns: ['el super', 'mi pueblo', 'cardenas', 'cardenas markets'],
    distanceBoostMiles: 0.25,
    delivery: { instacartAvailable: true, doordashAvailable: true },
  },
  {
    key: 'sams_club',
    displayName: "Sam's Club",
    matchPatterns: ["sam's club", 'sams club'],
    distanceBoostMiles: 0.3,
    wholesaleClub: true,
    delivery: { instacartAvailable: true, doordashAvailable: true },
  },
] as const;

/** Substrings that disqualify a POI even if tagged supermarket/grocery. */
export const GROCERY_NAME_EXCLUDE_PATTERNS: readonly string[] = [
  '7-eleven',
  '7 eleven',
  'circle k',
  'ampm',
  'am pm',
  'chevron',
  'shell',
  'arco',
  'valero',
  '76 ',
  ' gas ',
  'fuel',
  'walgreens',
  'cvs ',
  'cvs pharmacy',
  'rite aid',
  'dollar tree',
  'dollar general',
  'family dollar',
  '99 cents',
  '99¢',
  'liquor',
  'bevmo',
  'department',
  'macy',
  'nordstrom',
  'tj maxx',
  'ross ',
  'burlington',
  'big lots',
  'pharmacy',
  'wal-mart pharmacy',
] as const;

/** OSM shop values treated as non-grocery specialty when includeSpecialtyShops is false. */
export const SPECIALTY_SHOP_TAGS: readonly string[] = ['bakery', 'butcher', 'deli', 'seafood', 'cheese', 'alcohol'] as const;
