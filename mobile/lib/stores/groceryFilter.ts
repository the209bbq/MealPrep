import {
  GROCERY_CHAINS,
  type GroceryChainConfig,
  SPECIALTY_SHOP_TAGS,
} from '../../config/smartShopChains';
import { RETAILER_OSM_WIKIDATA_IDS } from '../../config/smartShopRetailers';
import { haversineMiles, SMART_SHOP_STORES } from '../../config/smartShop';
import { osmTagsMatchAnyRetailerGrocery } from '../smartShop/retailerLinks';
import type { StoreRecord } from './types';

export type OsmElementLike = {
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
};

export function haystackFromTags(tags: Record<string, string>): string {
  return [tags.name, tags.brand, tags.operator].filter(Boolean).join(' ').toLowerCase();
}

export function resolveGroceryChainFromHaystack(haystack: string): GroceryChainConfig | null {
  for (const chain of GROCERY_CHAINS) {
    if (chain.matchPatterns.some((p) => haystack.includes(p.toLowerCase()))) return chain;
  }
  return null;
}

export function resolveGroceryChainForStore(store: Pick<StoreRecord, 'name' | 'chain'>): GroceryChainConfig | null {
  return resolveGroceryChainFromHaystack(`${store.name} ${store.chain}`.toLowerCase());
}

export function isWholesaleClubHaystack(haystack: string): boolean {
  const chain = resolveGroceryChainFromHaystack(haystack);
  return Boolean(chain?.wholesaleClub);
}

const DISALLOWED_OSM_SHOPS = new Set([
  'convenience',
  'kiosk',
  'alcohol',
  'tobacco',
  'gas',
  'car_repair',
  'car',
  'newsagent',
  'ticket',
  'variety_store',
]);

const CORE_GROCERY_SHOPS = new Set([
  'supermarket',
  'grocery',
  'greengrocer',
  'butcher',
  'deli',
  'health_food',
  'international',
  'asian',
  'korean',
  'japanese',
  'chinese',
  'mexican',
  'indian',
  'vietnamese',
  'mediterranean',
  'halal',
  'kosher',
]);

function matchesExcludePattern(haystack: string): boolean {
  const lower = haystack.toLowerCase();
  if (lower.includes('dollar general market')) return false;
  if (
    /\b(cigarette|cigarettes|tobacco|smoke shop|beer wine|wine & gas|wine & spirits|liquor|vape|extramile|extra mile|amar beer)\b/i.test(
      lower,
    )
  ) {
    return true;
  }
  if (
    /\b(quick stop|quik stop|speedway|love'?s|flyers|mine-mart|fast & easy mart|five star food|wine vinegar)\b/i.test(
      lower,
    )
  ) {
    return true;
  }
  if (/\brocket\b/i.test(lower)) return true;
  return SMART_SHOP_STORES.nameExcludePatterns.some((p) => lower.includes(p.toLowerCase()));
}

/** “… Food Mart” convenience names — only if OSM shop is supermarket or grocery. */
export function foodMartAllowedForShopTags(tags: Record<string, string>): boolean {
  const haystack = haystackFromTags(tags);
  if (!/\bfood mart\b/i.test(haystack)) return true;
  const shop = (tags.shop ?? '').trim().toLowerCase();
  return shop === 'supermarket' || shop === 'grocery';
}

export function isAllowedOsmGroceryElement(tags: Record<string, string>): boolean {
  const shop = (tags.shop ?? '').toLowerCase();
  const haystack = haystackFromTags(tags);

  if (!tags.name?.trim()) return false;
  if (tags.amenity === 'fuel' || shop === 'fuel' || tags.amenity === 'gas_station') return false;
  if (DISALLOWED_OSM_SHOPS.has(shop)) return false;
  if (matchesExcludePattern(haystack)) return false;
  if (!foodMartAllowedForShopTags(tags)) return false;

  if (CORE_GROCERY_SHOPS.has(shop)) {
    return true;
  }

  if (shop === 'wholesale') {
    return isWholesaleClubHaystack(haystack);
  }

  if (shop === 'alcohol' || shop === 'seafood' || shop === 'cheese') {
    return false;
  }

  if (!SMART_SHOP_STORES.includeSpecialtyShops && SPECIALTY_SHOP_TAGS.some((t) => shop === t)) {
    return false;
  }

  if (shop === 'department_store' || shop === 'general') {
    return osmTagsMatchAnyRetailerGrocery(tags);
  }

  if (resolveGroceryChainFromHaystack(haystack)) {
    return shop !== 'convenience' && !DISALLOWED_OSM_SHOPS.has(shop);
  }

  return false;
}

type DistanceSortable = Pick<StoreRecord, 'name' | 'chain' | 'distanceMiles'>;

export function effectiveSortDistanceMiles(store: DistanceSortable): number {
  const base = store.distanceMiles ?? 999;
  const chain = resolveGroceryChainForStore(store);
  const boost = chain?.distanceBoostMiles ?? 0;
  return Math.max(0, base - boost);
}

export function rankGroceryStores(stores: StoreRecord[]): StoreRecord[] {
  return [...stores].sort((a, b) => effectiveSortDistanceMiles(a) - effectiveSortDistanceMiles(b));
}

export function dedupeGroceryStoresByName(stores: StoreRecord[]): StoreRecord[] {
  const radiusMiles = SMART_SHOP_STORES.duplicateRadiusMeters / 1609.344;
  const kept: StoreRecord[] = [];

  for (const store of stores) {
    const nameKey = store.name.trim().toLowerCase();
    const duplicate = kept.find((k) => {
      if (k.name.trim().toLowerCase() !== nameKey) return false;
      if (store.lat == null || store.lng == null || k.lat == null || k.lng == null) {
        return Math.abs((k.distanceMiles ?? 0) - (store.distanceMiles ?? 0)) < radiusMiles;
      }
      return haversineMiles({ lat: k.lat, lng: k.lng }, { lat: store.lat, lng: store.lng }) <= radiusMiles;
    });
    if (!duplicate) kept.push(store);
  }
  return kept;
}

export function sortStoresForDisplay(stores: StoreRecord[], favoriteIds: string[]): StoreRecord[] {
  const fav = new Set(favoriteIds);
  return [...stores].sort((a, b) => {
    const aFav = fav.has(a.id) ? 0 : 1;
    const bFav = fav.has(b.id) ? 0 : 1;
    if (aFav !== bFav) return aFav - bFav;
    return effectiveSortDistanceMiles(a) - effectiveSortDistanceMiles(b);
  });
}

type SortableStoreLocation = {
  id: string;
  name: string;
  chain: string;
  distanceMiles?: number;
  krogerLocationId?: string;
};

export function sortStoreLocationsForDisplay<T extends SortableStoreLocation>(
  stores: T[],
  favoriteIds: string[],
): T[] {
  const fav = new Set(favoriteIds);
  const key = (s: T) => s.krogerLocationId ?? s.id;
  return [...stores].sort((a, b) => {
    const aFav = fav.has(key(a)) ? 0 : 1;
    const bFav = fav.has(key(b)) ? 0 : 1;
    if (aFav !== bFav) return aFav - bFav;
    return effectiveSortDistanceMiles(a) - effectiveSortDistanceMiles(b);
  });
}

export function buildOverpassGroceryQuery(lat: number, lng: number, radiusMeters: number, maxResults: number): string {
  const around = `around:${radiusMeters},${lat},${lng}`;
  const groceryShop =
    'supermarket|grocery|greengrocer|butcher|deli|health_food|international|asian|korean|japanese|chinese|mexican|indian';
  const bigBoxShop = 'department_store|general';
  const wikidataUnion = RETAILER_OSM_WIKIDATA_IDS.map(
    (qid) => `
node["shop"~"${bigBoxShop}"]["brand:wikidata"="${qid}"](${around});
way["shop"~"${bigBoxShop}"]["brand:wikidata"="${qid}"](${around});`,
  ).join('');
  const brandNameUnion = `
node["shop"~"${bigBoxShop}"]["brand"~"Walmart|Target",i](${around});
way["shop"~"${bigBoxShop}"]["brand"~"Walmart|Target",i](${around});
node["shop"~"${bigBoxShop}"]["name"~"Walmart Supercenter|Walmart Neighborhood|Walmart|Target",i](${around});
way["shop"~"${bigBoxShop}"]["name"~"Walmart Supercenter|Walmart Neighborhood|Walmart|Target",i](${around});`;
  return `[out:json][timeout:${SMART_SHOP_STORES.overpassQueryTimeoutSec}];
(
node["shop"~"${groceryShop}"](${around});
way["shop"~"${groceryShop}"](${around});
node["shop"="wholesale"](${around});
way["shop"="wholesale"](${around});
${wikidataUnion}
${brandNameUnion}
);
out center ${maxResults};`;
}
