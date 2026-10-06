export type StoreSource = 'osm' | 'manual' | 'kroger';
export type StorePricingSource = 'kroger' | 'sample' | 'none';

export interface StoreRecord {
  id: string;
  name: string;
  chain: string;
  addressLine: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
  distanceMiles?: number;
  source: StoreSource;
  pricingSource: StorePricingSource;
  krogerLocationId?: string;
  url?: string;
  phone?: string;
  website?: string;
  /** Per-store delivery or order-ahead URL (Instacart, store portal, etc.). */
  deliveryUrl?: string;
  openingHours?: string;
  openNow?: boolean;
  /** When set, show a non-numeric pricing teaser (no invented prices). */
  pricingTeaser?: 'coming_soon';
  /** Original OSM `shop` tag when sourced from Overpass (static fallback filtering). */
  osmShop?: string;
}

export interface NearbyStoreSearchParams {
  lat?: number;
  lng?: number;
  zip?: string;
  radiusMiles?: number;
  /** True when search origin is device/saved GPS (tighter radius). */
  isGpsOrigin?: boolean;
  /** 1 = default; 2 = one-time wider search. */
  radiusMultiplier?: 1 | 2;
  /** Stores tab: cap list length after closest-first sort. */
  displayLimit?: number;
  /** Stores tab only: allow ZCTA table lookup for unresolved ZIPs. */
  useStoresTabZipTable?: boolean;
}

export interface ResolvedGeo {
  lat: number;
  lng: number;
  label: string;
}
