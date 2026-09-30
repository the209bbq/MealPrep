import { getKrogerProxyUrl, isKrogerConfigured, SMART_SHOP, SUPABASE_ANON_KEY } from '../../config/appConfig';
import type { FetchDealsParams, NearbyStoresParams, PricingProvider, StoreLocation } from './types';

interface KrogerProxyResponse {
  stores?: StoreLocation[];
  result?: Omit<import('./types').DealsSearchResult, 'mode' | 'providerId' | 'providerLabel'>;
  error?: string;
}

async function callKrogerProxy(body: Record<string, unknown>): Promise<KrogerProxyResponse> {
  const url = getKrogerProxyUrl();
  if (!url) throw new Error('Kroger proxy URL is not configured');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (SUPABASE_ANON_KEY.trim()) {
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      clientId: SMART_SHOP.krogerClientId.trim(),
      ...body,
    }),
  });

  const payload = (await response.json()) as KrogerProxyResponse;
  if (!response.ok) {
    throw new Error(payload.error ?? `Kroger proxy failed (${response.status})`);
  }
  return payload;
}

export const krogerPricingProvider: PricingProvider = {
  id: 'kroger',
  label: 'Kroger',
  isConfigured: () => isKrogerConfigured() && getKrogerProxyUrl().length > 0,
  async findNearbyStores(params: NearbyStoresParams): Promise<StoreLocation[]> {
    const data = await callKrogerProxy({
      action: 'stores',
      lat: params.lat,
      lng: params.lng,
      zip: params.zip,
      radiusMiles: params.radiusMiles ?? SMART_SHOP.defaultRadiusMiles,
    });
    return data.stores ?? [];
  },
  async fetchDeals(params: FetchDealsParams) {
    const data = await callKrogerProxy({
      action: 'deals',
      stores: params.stores,
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
