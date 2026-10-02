import { SMART_SHOP_COPY } from '../../config/smartShop';
import { callKrogerProxy, fetchKrogerLocations, isKrogerServerConfigured, toKrogerStoreLocation } from './krogerClient';
import { isKrogerProxyAvailable } from './krogerAvailability';
import type { FetchDealsParams, NearbyStoresParams, PricingProvider } from './types';

export async function fetchKrogerNearbyStores(params: NearbyStoresParams) {
  return fetchKrogerLocations({
    lat: params.lat,
    lng: params.lng,
    zip: params.zip,
    radiusMiles: params.radiusMiles,
  });
}

export const krogerPricingProvider: PricingProvider = {
  id: 'kroger',
  label: SMART_SHOP_COPY.pricingPartnerLabel,
  isConfigured: () => isKrogerProxyAvailable(),
  async fetchDeals(params: FetchDealsParams) {
    const krogerStores = params.stores
      .filter((s) => s.pricingSource === 'kroger' && (s.krogerLocationId || s.id))
      .map(toKrogerStoreLocation);

    if (krogerStores.length === 0) {
      return {
        stores: params.stores,
        deals: [],
        storeTotals: params.stores.map((s) => ({
          storeId: s.id,
          subtotal: 0,
          itemCount: 0,
          missingCount: params.items.length,
          pricesAvailable: false,
        })),
        suggestion: {
          kind: 'single_store',
          label: SMART_SHOP_COPY.pricesUnavailable,
          storeIds: [],
          estimatedTotal: 0,
          note: SMART_SHOP_COPY.livePricingNoMatches,
        },
      };
    }

    const data = await callKrogerProxy({
      action: 'deals',
      stores: krogerStores.map((s) => ({
        id: s.krogerLocationId ?? s.id,
        name: s.name,
        chain: s.chain,
        addressLine: s.addressLine,
        city: s.city,
        state: s.state,
        zip: s.zip,
        lat: s.lat,
        lng: s.lng,
        url: s.url,
      })),
      items: params.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      })),
    });

    if (!isKrogerServerConfigured(data)) {
      throw new Error(data.error ?? 'Live Kroger prices are not set up yet.');
    }
    if (!data.result) throw new Error('Kroger proxy returned no deal data');
    return data.result;
  },
};
