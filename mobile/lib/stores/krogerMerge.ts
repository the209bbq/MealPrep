import { haversineMiles, KROGER_CHAINS, SMART_SHOP_STORES } from '../../config/smartShop';
import type { StoreRecord } from './types';

export interface KrogerLocationRow {
  id: string;
  name: string;
  chain: string;
  addressLine: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
  url?: string;
}

function chainMatchesKroger(chain: string): boolean {
  const lower = chain.toLowerCase();
  return KROGER_CHAINS.some((c) => lower.includes(c.toLowerCase()));
}

export function mergeKrogerLocations(osmStores: StoreRecord[], krogerStores: KrogerLocationRow[]): StoreRecord[] {
  const mergeRadius = SMART_SHOP_STORES.krogerMergeRadiusMiles;
  const enriched = osmStores.map((store) => {
    if (store.krogerLocationId) return store;

    let best: KrogerLocationRow | undefined;
    let bestDist = mergeRadius + 1;
    for (const k of krogerStores) {
      if (store.lat == null || store.lng == null || k.lat == null || k.lng == null) {
        const nameMatch =
          chainMatchesKroger(k.chain) &&
          (store.chain.toLowerCase().includes(k.chain.toLowerCase()) ||
            store.name.toLowerCase().includes(k.chain.toLowerCase()));
        if (nameMatch && !best) best = k;
        continue;
      }
      const dist = haversineMiles({ lat: store.lat, lng: store.lng }, { lat: k.lat, lng: k.lng });
      if (dist <= mergeRadius && dist < bestDist) {
        best = k;
        bestDist = dist;
      }
    }

    if (!best) {
      if (chainMatchesKroger(store.chain) || chainMatchesKroger(store.name)) {
        return { ...store, pricingSource: 'none' as const };
      }
      return store;
    }

    return {
      ...store,
      krogerLocationId: best.id,
      pricingSource: 'kroger' as const,
      chain: best.chain || store.chain,
      url: best.url ?? store.url,
    };
  });

  const seenKroger = new Set(enriched.filter((s) => s.krogerLocationId).map((s) => s.krogerLocationId));
  for (const k of krogerStores) {
    if (seenKroger.has(k.id)) continue;
    enriched.push({
      id: `kroger-${k.id}`,
      name: k.name,
      chain: k.chain,
      addressLine: k.addressLine,
      city: k.city,
      state: k.state,
      zip: k.zip,
      lat: k.lat,
      lng: k.lng,
      source: 'kroger',
      pricingSource: 'kroger',
      krogerLocationId: k.id,
      url: k.url,
      distanceMiles: undefined,
    });
  }

  return enriched;
}
