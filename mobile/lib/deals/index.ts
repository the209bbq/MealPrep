import { SMART_SHOP } from '../../config/appConfig';
import { mergeKrogerLocations } from '../stores/krogerMerge';
import { searchNearbyGroceryStores, type StoreRecord } from '../stores';
import { assembleDealsResult, remapKrogerDealsToStores, storeRecordToLocation } from './buildShopResult';
import { fetchKrogerNearbyStores, krogerPricingProvider } from './krogerProvider';
import { samplePricingProvider } from './sampleProvider';
import type { DealsSearchResult, FetchDealsParams, NearbyStoresParams, StoreLocation } from './types';

export type { DealsSearchResult, ItemStoreDeal, PricingProvider, ShopSuggestion, StoreLocation } from './types';

export async function searchNearbyStores(params: NearbyStoresParams): Promise<{
  stores: StoreLocation[];
  originLabel: string;
}> {
  const { origin, stores } = await searchNearbyGroceryStores({
    lat: params.lat,
    lng: params.lng,
    zip: params.zip,
    radiusMiles: params.radiusMiles ?? SMART_SHOP.defaultRadiusMiles,
  });

  let merged: StoreRecord[] = stores;
  if (krogerPricingProvider.isConfigured()) {
    try {
      const krogerRows = await fetchKrogerNearbyStores({
        lat: origin.lat,
        lng: origin.lng,
        zip: params.zip,
        radiusMiles: params.radiusMiles ?? SMART_SHOP.defaultRadiusMiles,
      });
      merged = mergeKrogerLocations(stores, krogerRows);
    } catch {
      merged = stores;
    }
  }

  return {
    originLabel: origin.label,
    stores: merged.map(storeRecordToLocation),
  };
}

export async function searchDeals(params: FetchDealsParams): Promise<DealsSearchResult> {
  const { stores, items } = params;

  if (krogerPricingProvider.isConfigured()) {
    try {
      const payload = await krogerPricingProvider.fetchDeals({ stores, items });
      const deals = remapKrogerDealsToStores(payload.deals, stores);
      return assembleDealsResult({
        mode: 'live',
        providerId: 'kroger',
        providerLabel: 'Kroger',
        pricingNote:
          deals.length > 0
            ? 'Live Kroger prices at Kroger-family stores. Other nearby chains: prices not available.'
            : 'No Kroger prices for this list — select a Kroger-family store or check your list items.',
        stores,
        deals,
        items,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Kroger pricing unavailable';
      const sample = await samplePricingProvider.fetchDeals({ stores, items });
      return assembleDealsResult({
        mode: 'sample',
        providerId: 'sample',
        providerLabel: 'Sample deals',
        pricingNote: `${message}. Showing sample deals until Kroger is set up.`,
        stores: sample.stores,
        deals: sample.deals,
        items,
      });
    }
  }

  const sample = await samplePricingProvider.fetchDeals({ stores, items });
  const note = krogerPricingProvider.isConfigured()
    ? undefined
    : 'Sample deals — set KROGER_CLIENT_ID/SECRET on Supabase and EXPO_PUBLIC_KROGER_CLIENT_ID for real prices.';

  return assembleDealsResult({
    mode: 'sample',
    providerId: 'sample',
    providerLabel: 'Sample deals',
    pricingNote: note,
    stores: sample.stores,
    deals: sample.deals,
    items,
  });
}
