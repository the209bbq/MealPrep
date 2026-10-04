import type { GroceryListItem } from '../../types/mealprep';

export type DealsMode = 'live' | 'sample';
export type StorePricingSource = 'kroger' | 'sample' | 'community' | 'none';
export type DealPriceSource = 'kroger' | 'sample' | 'community';

export interface StoreLocation {
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
  source?: 'osm' | 'manual' | 'kroger';
  pricingSource?: StorePricingSource;
  krogerLocationId?: string;
  url?: string;
  phone?: string;
  website?: string;
  deliveryUrl?: string;
  openingHours?: string;
  openNow?: boolean;
  pricingTeaser?: 'coming_soon';
}

export interface ItemStoreDeal {
  groceryItemId: string;
  storeId: string;
  productTitle: string;
  unitPrice: number;
  lineTotal: number;
  quantity: number;
  unit: string;
  promoLabel?: string;
  productUrl?: string;
  priceSource?: DealPriceSource;
  communityDealId?: string;
  communityReportedAt?: string;
}

export interface StoreCartTotal {
  storeId: string;
  subtotal: number;
  itemCount: number;
  missingCount: number;
  promoCount?: number;
  pricesAvailable?: boolean;
  rankScore?: number;
}

export interface ShopSuggestion {
  kind: 'single_store' | 'split_stores';
  label: string;
  storeIds: string[];
  estimatedTotal: number;
  note?: string;
}

export interface DealsSearchResult {
  mode: DealsMode;
  providerId: string;
  providerLabel: string;
  pricingNote?: string;
  stores: StoreLocation[];
  deals: ItemStoreDeal[];
  storeTotals: StoreCartTotal[];
  suggestion: ShopSuggestion;
}

export interface NearbyStoresParams {
  lat?: number;
  lng?: number;
  zip?: string;
  radiusMiles?: number;
}

export interface FetchDealsParams {
  stores: StoreLocation[];
  items: GroceryListItem[];
}

export interface PricingProvider {
  id: string;
  label: string;
  isConfigured: () => boolean;
  fetchDeals: (params: FetchDealsParams) => Promise<Omit<DealsSearchResult, 'mode' | 'providerId' | 'providerLabel' | 'pricingNote'>>;
}
