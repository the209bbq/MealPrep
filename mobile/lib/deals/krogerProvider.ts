import { getKrogerProxyUrl, isKrogerConfigured } from '../../config/appConfig';
import { callKrogerProxy, toKrogerStoreLocation, type KrogerProxyStoreRow } from './krogerClient';
import type { FetchDealsParams, NearbyStoresParams, PricingProvider, StoreLocation } from './types';

export async function fetchKrogerNearbyStores(params: NearbyStoresParams): Promise<KrogerProxyStoreRow[]> {
  if (!isKrogerConfigured() || !getKrogerProxyUrl()) return [];
  const data = await callKrogerProxy({
    action: 'stores',
    lat: params.lat,
    lng: params.lng,
    zip: params.zip,
    radiusMiles: params.radiusMiles,
  });
  return data.stores ?? [];
}

export const krogerPricingProvider: PricingProvider = {
  id: 'kroger',
  label: 'Kroger',
  isConfigured: () => isKrogerConfigured() && getKrogerProxyUrl().length > 0,
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
          label: 'No Kroger locations selected',
          storeIds: [],
          estimatedTotal: 0,
          note: 'Pick a Kroger-family store for live prices, or use sample mode.',
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

    if (!data.result) throw new Error('Kroger proxy returned no deal data');
    return data.result;
  },
};
