import { SMART_SHOP_COPY } from '../../config/smartShop';
import type {
  DealsSearchResult,
  ItemStoreDeal,
  ShopSuggestion,
  StoreCartTotal,
  StoreLocation,
} from './types';
import type { GroceryListItem } from '../../types/mealprep';

function buildTotals(
  stores: StoreLocation[],
  deals: ItemStoreDeal[],
  itemCount: number,
  mode: 'live' | 'sample',
): StoreCartTotal[] {
  return stores.map((store) => {
    const storeDeals = deals.filter((d) => d.storeId === store.id);
    const subtotal = storeDeals.reduce((sum, d) => sum + d.lineTotal, 0);
    const promoCount = storeDeals.filter((d) => d.promoLabel).length;
    const pricesAvailable =
      mode === 'sample'
        ? storeDeals.length > 0
        : storeDeals.some((d) => d.priceSource === 'kroger' || d.priceSource === 'community');
    const itemCountPriced = storeDeals.length;
    const rankScore = pricesAvailable ? itemCountPriced * 1000 - subtotal : itemCountPriced;
    return {
      storeId: store.id,
      subtotal: Math.round(subtotal * 100) / 100,
      itemCount: itemCountPriced,
      missingCount: Math.max(0, itemCount - itemCountPriced),
      promoCount,
      pricesAvailable,
      rankScore,
    };
  });
}

function buildSuggestion(
  totals: StoreCartTotal[],
  stores: StoreLocation[],
  deals: ItemStoreDeal[],
  itemIds: string[],
  mode: 'live' | 'sample',
): ShopSuggestion {
  const pricedTotals = totals.filter((t) => t.pricesAvailable && t.itemCount > 0);
  const sortedByCoverage = [...totals].sort((a, b) => (b.rankScore ?? 0) - (a.rankScore ?? 0));
  const bestCoverage = sortedByCoverage[0];

  const realPricedTotals = pricedTotals.filter((t) => {
    const storeDeals = deals.filter((d) => d.storeId === t.storeId);
    return storeDeals.some((d) => d.priceSource === 'kroger' || d.priceSource === 'community');
  });
  const rankingTotals = mode === 'sample' ? pricedTotals : realPricedTotals;
  const cheapestRanked = [...rankingTotals].sort((a, b) => a.subtotal - b.subtotal)[0];

  if (!cheapestRanked && bestCoverage) {
    const store = stores.find((s) => s.id === bestCoverage.storeId);
    return {
      kind: 'single_store',
      label: store ? `Nearby: ${store.chain}` : 'Nearby stores',
      storeIds: [bestCoverage.storeId],
      estimatedTotal: 0,
      note: mode === 'live' ? SMART_SHOP_COPY.pricesUnavailable : undefined,
    };
  }

  if (!cheapestRanked) {
    return { kind: 'single_store', label: 'No stores selected', storeIds: [], estimatedTotal: 0 };
  }

  const rankingDeals =
    mode === 'sample'
      ? deals
      : deals.filter((d) => d.priceSource === 'kroger' || d.priceSource === 'community');

  const splitStoreIds = new Set<string>();
  let splitTotal = 0;
  for (const itemId of itemIds) {
    const itemDeals = rankingDeals.filter((d) => d.groceryItemId === itemId);
    if (itemDeals.length === 0) continue;
    const cheapestDeal = itemDeals.reduce((a, b) => (a.lineTotal < b.lineTotal ? a : b));
    splitStoreIds.add(cheapestDeal.storeId);
    splitTotal += cheapestDeal.lineTotal;
  }
  splitTotal = Math.round(splitTotal * 100) / 100;

  if (splitStoreIds.size > 1 && splitTotal + 0.001 < cheapestRanked.subtotal) {
    const chains = [...splitStoreIds]
      .map((id) => stores.find((s) => s.id === id)?.chain ?? 'store')
      .join(' + ');
    return {
      kind: 'split_stores',
      label: `Split trip: ${chains}`,
      storeIds: [...splitStoreIds],
      estimatedTotal: splitTotal,
      note: mode === 'sample' ? undefined : SMART_SHOP_COPY.livePricingMatched,
    };
  }

  const store = stores.find((s) => s.id === cheapestRanked.storeId);
  const coverageNote =
    bestCoverage && bestCoverage.storeId !== cheapestRanked.storeId
      ? `Best coverage: ${stores.find((s) => s.id === bestCoverage.storeId)?.chain ?? 'store'} (${bestCoverage.itemCount}/${itemIds.length} items priced).`
      : undefined;

  return {
    kind: 'single_store',
    label: store ? `Best value: ${store.chain}` : 'Cheapest store',
    storeIds: [cheapestRanked.storeId],
    estimatedTotal: cheapestRanked.subtotal,
    note: coverageNote,
  };
}

export function assembleDealsResult(params: {
  mode: 'live' | 'sample';
  providerId: string;
  providerLabel: string;
  pricingNote?: string;
  stores: StoreLocation[];
  deals: ItemStoreDeal[];
  items: GroceryListItem[];
}): DealsSearchResult {
  const storeTotals = buildTotals(params.stores, params.deals, params.items.length, params.mode);
  const sortedTotals = [...storeTotals].sort((a, b) => (b.rankScore ?? 0) - (a.rankScore ?? 0));
  return {
    mode: params.mode,
    providerId: params.providerId,
    providerLabel: params.providerLabel,
    pricingNote: params.pricingNote,
    stores: params.stores,
    deals: params.deals,
    storeTotals: sortedTotals,
    suggestion: buildSuggestion(
      storeTotals,
      params.stores,
      params.deals,
      params.items.map((i) => i.id),
      params.mode,
    ),
  };
}

/** Map Kroger proxy deals (keyed by Kroger location id) onto app store ids. */
export function remapKrogerDealsToStores(
  deals: ItemStoreDeal[],
  stores: StoreLocation[],
): ItemStoreDeal[] {
  const krogerToStore = new Map<string, string>();
  for (const s of stores) {
    if (s.krogerLocationId) krogerToStore.set(s.krogerLocationId, s.id);
    if (s.pricingSource === 'kroger') krogerToStore.set(s.id, s.id);
  }
  return deals.map((d) => {
    const mapped = krogerToStore.get(d.storeId);
    return mapped ? { ...d, storeId: mapped } : d;
  });
}

export function storeRecordToLocation(store: import('../stores/types').StoreRecord): StoreLocation {
  return {
    id: store.id,
    name: store.name,
    chain: store.chain,
    addressLine: store.addressLine,
    city: store.city,
    state: store.state,
    zip: store.zip,
    lat: store.lat,
    lng: store.lng,
    distanceMiles: store.distanceMiles,
    source: store.source,
    pricingSource: store.pricingSource,
    krogerLocationId: store.krogerLocationId,
    url: store.url,
    phone: store.phone,
    website: store.website,
    deliveryUrl: store.deliveryUrl,
    openingHours: store.openingHours,
    openNow: store.openNow,
    pricingTeaser: store.pricingTeaser,
    knownBrand: store.knownBrand,
  };
}
