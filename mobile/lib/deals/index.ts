import { SMART_SHOP } from '../../config/appConfig';
import { mergeKrogerLocations } from '../stores/krogerMerge';
import { searchNearbyGroceryStores, type StoreRecord } from '../stores';
import { assembleDealsResult, remapKrogerDealsToStores, storeRecordToLocation } from './buildShopResult';
import { KROGER_NOT_CONFIGURED_NOTE, isKrogerProxyAvailable } from './krogerAvailability';
import { fetchKrogerLocations } from './krogerClient';
import { fetchKrogerNearbyStores, krogerPricingProvider } from './krogerProvider';
import { samplePricingProvider } from './sampleProvider';
import type { DealsSearchResult, FetchDealsParams, NearbyStoresParams, StoreLocation } from './types';

export type { DealsSearchResult, ItemStoreDeal, PricingProvider, ShopSuggestion, StoreLocation } from './types';

async function sampleDealsResult(
  stores: StoreLocation[],
  items: FetchDealsParams['items'],
  pricingNote?: string,
): Promise<DealsSearchResult> {
  const sample = await samplePricingProvider.fetchDeals({ stores, items });
  return assembleDealsResult({
    mode: 'sample',
    providerId: 'sample',
    providerLabel: 'Sample deals',
    pricingNote,
    stores: sample.stores,
    deals: sample.deals,
    items,
  });
}

async function isKrogerServerReady(stores: StoreLocation[]): Promise<boolean> {
  const anchor = stores.find((s) => s.lat != null && s.lng != null) ?? stores[0];
  if (!anchor) return false;
  const { serverConfigured } = await fetchKrogerLocations({
    lat: anchor.lat,
    lng: anchor.lng,
    zip: anchor.zip,
    radiusMiles: SMART_SHOP.defaultRadiusMiles,
  });
  return serverConfigured;
}

export async function searchNearbyStores(params: NearbyStoresParams): Promise<{
  stores: StoreLocation[];
  originLabel: string;
  storeSearchWarning?: string;
}> {
  const { origin, stores, osmWarning } = await searchNearbyGroceryStores({
    lat: params.lat,
    lng: params.lng,
    zip: params.zip,
    radiusMiles: params.radiusMiles ?? SMART_SHOP.defaultRadiusMiles,
  });

  let merged: StoreRecord[] = stores;
  let warning = osmWarning;

  if (isKrogerProxyAvailable()) {
    try {
      const { stores: krogerRows, serverConfigured } = await fetchKrogerNearbyStores({
        lat: origin.lat,
        lng: origin.lng,
        zip: params.zip,
        radiusMiles: params.radiusMiles ?? SMART_SHOP.defaultRadiusMiles,
      });
      if (serverConfigured) {
        merged = mergeKrogerLocations(stores, krogerRows);
      } else if (!warning) {
        warning = 'Kroger locations unavailable until API secrets are added on Supabase.';
      }
    } catch {
      if (!warning) warning = 'Kroger location lookup failed. Showing OpenStreetMap stores only.';
    }
  }

  return {
    originLabel: origin.label,
    storeSearchWarning: warning,
    stores: merged.map(storeRecordToLocation),
  };
}

export async function searchDeals(params: FetchDealsParams): Promise<DealsSearchResult> {
  const { stores, items } = params;

  if (!isKrogerProxyAvailable()) {
    return sampleDealsResult(
      stores,
      items,
      'SAMPLE deals — sign in with Supabase to use the kroger-deals Edge Function.',
    );
  }

  const hasKrogerStore = stores.some((s) => s.pricingSource === 'kroger');
  if (!hasKrogerStore) {
    const ready = await isKrogerServerReady(stores);
    if (!ready) {
      return sampleDealsResult(stores, items, KROGER_NOT_CONFIGURED_NOTE);
    }
  }

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
          : 'No Kroger prices matched this list at selected stores.',
      stores,
      deals,
      items,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Kroger pricing unavailable';
    const isNotConfigured = /not configured/i.test(message);
    return sampleDealsResult(
      stores,
      items,
      isNotConfigured ? KROGER_NOT_CONFIGURED_NOTE : `${message}. Showing SAMPLE deals.`,
    );
  }
}
