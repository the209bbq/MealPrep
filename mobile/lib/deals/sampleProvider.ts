import type { GroceryListItem } from '../../types/mealprep';
import type { FetchDealsParams, ItemStoreDeal, NearbyStoresParams, PricingProvider, StoreCartTotal, StoreLocation, ShopSuggestion } from './types';

const SAMPLE_CHAINS = ['Save Mart', 'FoodMaxx', 'Lucky', 'Raleys'] as const;

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

function sampleStores(params: NearbyStoresParams): StoreLocation[] {
  const zip = params.zip?.trim() || '95350';
  const seed = hashString(zip);
  return SAMPLE_CHAINS.map((chain, index) => {
    const id = `sample-${chain.toLowerCase().replace(/\s/g, '')}-${zip}`;
    const offset = ((seed + index * 17) % 900) / 100;
    return {
      id,
      name: `${chain} #${100 + index + (seed % 40)}`,
      chain,
      addressLine: `${1200 + index * 80 + (seed % 200)} Sample Blvd`,
      city: 'Modesto',
      state: 'CA',
      zip,
      lat: params.lat != null ? params.lat + offset * 0.01 : undefined,
      lng: params.lng != null ? params.lng - offset * 0.01 : undefined,
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(chain + ' ' + zip)}`,
    };
  });
}

function unitPriceFor(item: GroceryListItem, store: StoreLocation): number {
  const base = 1.25 + (hashString(`${store.id}:${item.name}`) % 450) / 100;
  return Math.round(base * 100) / 100;
}

function buildTotals(stores: StoreLocation[], deals: ItemStoreDeal[], itemCount: number): StoreCartTotal[] {
  return stores.map((store) => {
    const storeDeals = deals.filter((d) => d.storeId === store.id);
    const subtotal = storeDeals.reduce((sum, d) => sum + d.lineTotal, 0);
    return {
      storeId: store.id,
      subtotal: Math.round(subtotal * 100) / 100,
      itemCount: storeDeals.length,
      missingCount: Math.max(0, itemCount - storeDeals.length),
    };
  });
}

function buildSuggestion(
  totals: StoreCartTotal[],
  stores: StoreLocation[],
  deals: ItemStoreDeal[],
  itemIds: string[],
): ShopSuggestion {
  const sorted = [...totals].sort((a, b) => a.subtotal - b.subtotal);
  const best = sorted[0];
  if (!best) {
    return { kind: 'single_store', label: 'No stores', storeIds: [], estimatedTotal: 0 };
  }

  const splitStoreIds = new Set<string>();
  let splitTotal = 0;
  for (const itemId of itemIds) {
    const itemDeals = deals.filter((d) => d.groceryItemId === itemId);
    if (itemDeals.length === 0) continue;
    const cheapest = itemDeals.reduce((a, b) => (a.lineTotal < b.lineTotal ? a : b));
    splitStoreIds.add(cheapest.storeId);
    splitTotal += cheapest.lineTotal;
  }
  splitTotal = Math.round(splitTotal * 100) / 100;

  if (splitStoreIds.size > 1 && splitTotal + 0.001 < best.subtotal) {
    const chains = [...splitStoreIds]
      .map((id) => stores.find((s) => s.id === id)?.chain ?? 'store')
      .join(' + ');
    return {
      kind: 'split_stores',
      label: `Split trip: ${chains}`,
      storeIds: [...splitStoreIds],
      estimatedTotal: splitTotal,
      note: 'Sample pricing for demo — connect Kroger for live deals.',
    };
  }

  const store = stores.find((s) => s.id === best.storeId);
  return {
    kind: 'single_store',
    label: store ? `Shop all at ${store.chain}` : 'Cheapest single store',
    storeIds: [best.storeId],
    estimatedTotal: best.subtotal,
    note: 'Sample pricing for demo — connect Kroger for live deals.',
  };
}

export const samplePricingProvider: PricingProvider = {
  id: 'sample',
  label: 'Sample deals',
  isConfigured: () => true,
  async findNearbyStores(params: NearbyStoresParams): Promise<StoreLocation[]> {
    return sampleStores(params);
  },
  async fetchDeals(params: FetchDealsParams) {
    const { stores, items } = params;
    const deals: ItemStoreDeal[] = [];
    for (const item of items) {
      for (const store of stores) {
        const unitPrice = unitPriceFor(item, store);
        const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
        const promoRoll = hashString(`${store.id}:${item.id}`) % 5;
        deals.push({
          groceryItemId: item.id,
          storeId: store.id,
          productTitle: item.name,
          unitPrice,
          lineTotal,
          quantity: item.quantity,
          unit: item.unit,
          promoLabel: promoRoll === 0 ? 'Weekly special' : undefined,
          productUrl: store.url,
        });
      }
    }
    const storeTotals = buildTotals(stores, deals, items.length);
    return {
      stores,
      deals,
      storeTotals,
      suggestion: buildSuggestion(
        storeTotals,
        stores,
        deals,
        items.map((i) => i.id),
      ),
    };
  },
};
