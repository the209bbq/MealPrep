import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveStoreChainKey } from '../../config/weeklyAds';
import type { GroceryListItem } from '../../types/mealprep';
import { readSavedStoreSummaries } from '../smartShop/storage';
import type { StoreLocation } from '../deals/types';
import {
  fetchCommunityDealsForStoreKeys,
  filterVisibleCommunityDeals,
} from './client';
import { buildGroceryCommunityBadges, type GroceryCommunityDealBadge } from './matchItem';
import type { CommunityStoreDeal, FetchCommunityDealsResult } from './types';

export function chainKeysFromSavedStores(): string[] {
  const summaries = readSavedStoreSummaries();
  const keys = summaries
    .map((s) =>
      resolveStoreChainKey({ name: s.name, chain: s.chain, krogerLocationId: undefined, pricingSource: 'none' }),
    )
    .filter((k): k is string => Boolean(k));
  return [...new Set(keys)];
}

export function chainKeysFromStores(stores: StoreLocation[]): string[] {
  return [...new Set(stores.map((s) => resolveStoreChainKey(s)).filter((k): k is string => Boolean(k)))];
}

export function useCommunityDealsForStores(storeKeys: string[]) {
  const keySignature = storeKeys.slice().sort().join('|');
  const [result, setResult] = useState<FetchCommunityDealsResult>({ deals: [], tableMissing: false });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (storeKeys.length === 0) {
      setResult({ deals: [], tableMissing: false });
      return;
    }
    setLoading(true);
    try {
      const next = await fetchCommunityDealsForStoreKeys(storeKeys);
      setResult(next);
    } finally {
      setLoading(false);
    }
  }, [keySignature]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visibleDeals = useMemo(() => filterVisibleCommunityDeals(result.deals), [result.deals]);

  return { ...result, deals: visibleDeals, loading, refresh };
}

export function useGroceryCommunityDealBadges(openItemIds: string[], items: GroceryListItem[]) {
  const storeKeys = useMemo(() => chainKeysFromSavedStores(), []);
  const { deals, loading } = useCommunityDealsForStores(storeKeys);

  const storeLabelByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const deal of deals) {
      if (!map.has(deal.storeKey)) {
        map.set(deal.storeKey, deal.storeName ?? deal.storeKey.replace(/_/g, ' '));
      }
    }
    for (const summary of readSavedStoreSummaries()) {
      const key = resolveStoreChainKey({
        name: summary.name,
        chain: summary.chain,
        krogerLocationId: undefined,
        pricingSource: 'none',
      });
      if (key && !map.has(key)) map.set(key, summary.chain || summary.name);
    }
    return map;
  }, [deals]);

  const badges = useMemo(() => {
    const openItems = items.filter((i) => openItemIds.includes(i.id));
    return buildGroceryCommunityBadges(openItems, deals, storeLabelByKey);
  }, [deals, items, openItemIds, storeLabelByKey]);

  return { badges, loading, hasStores: storeKeys.length > 0 };
}

export type { GroceryCommunityDealBadge, CommunityStoreDeal };
