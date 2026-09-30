import { krogerPricingProvider } from './krogerProvider';
import { samplePricingProvider } from './sampleProvider';
import type { DealsSearchResult, FetchDealsParams, NearbyStoresParams, PricingProvider } from './types';

export type { DealsSearchResult, ItemStoreDeal, PricingProvider, ShopSuggestion, StoreLocation } from './types';

export function resolvePricingProvider(): PricingProvider {
  if (krogerPricingProvider.isConfigured()) return krogerPricingProvider;
  return samplePricingProvider;
}

export async function searchNearbyStores(params: NearbyStoresParams) {
  const provider = resolvePricingProvider();
  const stores = await provider.findNearbyStores(params);
  return { provider, stores };
}

export async function searchDeals(params: FetchDealsParams): Promise<DealsSearchResult> {
  const provider = resolvePricingProvider();
  const mode = provider.id === 'sample' ? 'sample' : 'live';
  const payload = await provider.fetchDeals(params);
  return {
    mode,
    providerId: provider.id,
    providerLabel: provider.label,
    ...payload,
  };
}
