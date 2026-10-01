import { SMART_SHOP } from '../../config/appConfig';
import { SMART_SHOP_COPY } from '../../config/smartShop';
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
    providerLabel: SMART_SHOP_COPY.estimatedPricesTitle,
    pricingNote: pricingNote ?? SMART_SHOP_COPY.estimatedPricesNote,
    stores: sample.stores,
    deals: sample.deals,
    items,
  });
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
        warning = SMART_SHOP_COPY.livePricingUnavailable;
      }
    } catch {
      if (!warning) warning = SMART_SHOP_COPY.livePricingUnavailable;
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
    return sampleDealsResult(stores, items, SMART_SHOP_COPY.estimatedPricesNote);
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
      return sampleDealsResult(stores, items, KROGER_NOT_CONFIGURED_NOTE);
    }
    if (krogerRows.length === 0) {
      return sampleDealsResult(
        stores,
        items,
        SMART_SHOP_COPY.noLiveStoresNearby,
      );
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
    return sampleDealsResult(
      stores,
      items,
      isNotConfigured ? KROGER_NOT_CONFIGURED_NOTE : SMART_SHOP_COPY.estimatedPricesNote,
    );
  }
}
