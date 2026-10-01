import { SMART_SHOP } from '../../config/appConfig';
import { SMART_SHOP_COPY } from '../../config/smartShop';
import { mergeKrogerLocations } from '../stores/krogerMerge';
import { previewNearbyGroceryStores, searchNearbyGroceryStores, type StoreRecord } from '../stores';
import { assembleDealsResult, remapKrogerDealsToStores, storeRecordToLocation } from './buildShopResult';
import { KROGER_NOT_CONFIGURED_NOTE, isKrogerProxyAvailable } from './krogerAvailability';
import { fetchKrogerLocations } from './krogerClient';
import { fetchKrogerNearbyStores, krogerPricingProvider } from './krogerProvider';
import type { DealsSearchResult, FetchDealsParams, NearbyStoresParams, StoreLocation } from './types';

export type { DealsSearchResult, ItemStoreDeal, PricingProvider, ShopSuggestion, StoreLocation } from './types';

function liveDealsWithoutPricing(
  stores: StoreLocation[],
  items: FetchDealsParams['items'],
  pricingNote: string,
): DealsSearchResult {
  return assembleDealsResult({
    mode: 'live',
    providerId: 'none',
    providerLabel: SMART_SHOP_COPY.noLivePricesLabel,
    pricingNote,
    stores,
    deals: [],
    items,
  });
}

export function nearbyStoresInstantPreview(params: NearbyStoresParams): {
  stores: StoreLocation[];
  originLabel: string;
} | null {
  const preview = previewNearbyGroceryStores({
    lat: params.lat,
    lng: params.lng,
    zip: params.zip,
    radiusMiles: params.radiusMiles ?? SMART_SHOP.defaultRadiusMiles,
  });
  if (!preview) return null;
  return {
    originLabel: preview.origin.label,
    stores: preview.stores.map(storeRecordToLocation),
  };
}

export async function searchNearbyStores(params: NearbyStoresParams): Promise<{
  stores: StoreLocation[];
  originLabel: string;
  storeSearchWarning?: string;
  storeSearchFailed?: boolean;
}> {
  const { origin, stores, osmWarning, storeSearchFailed } = await searchNearbyGroceryStores({
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
        warning = SMART_SHOP_COPY.livePricingUnavailable;
      }
    } catch {
      if (!warning) warning = SMART_SHOP_COPY.livePricingUnavailable;
    }
  }

  return {
    originLabel: origin.label,
    storeSearchWarning: warning,
    storeSearchFailed,
    stores: merged.map(storeRecordToLocation),
  };
}

export async function searchDeals(params: FetchDealsParams): Promise<DealsSearchResult> {
  const { stores, items } = params;
  const noPricing = (note: string) => liveDealsWithoutPricing(stores, items, note);

  if (!isKrogerProxyAvailable()) {
    return noPricing(SMART_SHOP_COPY.noLivePricesHint);
  }

  const hasKrogerStore = stores.some((s) => s.pricingSource === 'kroger');
  if (!hasKrogerStore) {
    const anchor = stores.find((s) => s.lat != null && s.lng != null) ?? stores[0];
    const { serverConfigured, stores: krogerRows } = anchor
      ? await fetchKrogerLocations({
          lat: anchor.lat,
          lng: anchor.lng,
          zip: anchor.zip,
          radiusMiles: SMART_SHOP.defaultRadiusMiles,
        })
      : { serverConfigured: false, stores: [] };
    if (!serverConfigured) {
      return noPricing(KROGER_NOT_CONFIGURED_NOTE);
    }
    if (krogerRows.length === 0) {
      return noPricing(SMART_SHOP_COPY.noLiveStoresNearbyHint);
    }
  }

  try {
    const payload = await krogerPricingProvider.fetchDeals({ stores, items });
    const deals = remapKrogerDealsToStores(payload.deals, stores);
    return assembleDealsResult({
      mode: 'live',
      providerId: 'kroger',
      providerLabel: SMART_SHOP_COPY.pricingPartnerLabel,
      pricingNote:
        deals.length > 0 ? SMART_SHOP_COPY.livePricingMatched : SMART_SHOP_COPY.livePricingNoMatches,
      stores,
      deals,
      items,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : SMART_SHOP_COPY.livePricingUnavailable;
    const isNotConfigured = /not configured/i.test(message);
    return noPricing(isNotConfigured ? KROGER_NOT_CONFIGURED_NOTE : SMART_SHOP_COPY.noLivePricesHint);
  }
}
