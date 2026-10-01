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

function matchesExcludePattern(haystack: string): boolean {
  return SMART_SHOP_STORES.nameExcludePatterns.some((p) => haystack.includes(p.toLowerCase()));
}

export function isAllowedOsmGroceryElement(tags: Record<string, string>): boolean {
  const shop = tags.shop ?? '';
  const haystack = haystackFromTags(tags);

  if (!tags.name?.trim()) return false;
  if (matchesExcludePattern(haystack)) return false;

  if (shop === 'supermarket' || shop === 'grocery') {
    return true;
  }

  if (shop === 'wholesale') {
    return isWholesaleClubHaystack(haystack);
  }

  if (!SMART_SHOP_STORES.includeSpecialtyShops && SPECIALTY_SHOP_TAGS.some((t) => shop === t)) {
    return false;
  }

  if (shop === 'department_store' || shop === 'general') {
    return osmTagsMatchAnyRetailerGrocery(tags);
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
node["shop"="supermarket"](${around});
node["shop"="grocery"](${around});
way["shop"="supermarket"](${around});
way["shop"="grocery"](${around});
${wikidataUnion}
${brandNameUnion}
);
out center ${maxResults};`;
}
