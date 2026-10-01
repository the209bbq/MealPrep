import { SMART_SHOP_COPY } from '../../config/smartShop';
import type { GroceryListItem } from '../../types/mealprep';
import {
  computeLineTotal,
  packagesNeededForLine,
  parsePackageSizeFromText,
} from './packagePricing';
import type { FetchDealsParams, ItemStoreDeal, PricingProvider, StoreLocation } from './types';

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

function unitPriceFor(item: GroceryListItem, store: StoreLocation): number {
  const base = 1.25 + (hashString(`${store.id}:${item.name}`) % 450) / 100;
  return Math.round(base * 100) / 100;
}

export const samplePricingProvider: PricingProvider = {
  id: 'sample',
  label: SMART_SHOP_COPY.estimatedPricesTitle,
  isConfigured: () => true,
  async fetchDeals(params: FetchDealsParams) {
    const { stores, items } = params;
    const pricedStores = stores.map((s) => ({ ...s, pricingSource: 'sample' as const }));
    const deals: ItemStoreDeal[] = [];
    for (const item of items) {
      for (const store of pricedStores) {
        const unitPrice = unitPriceFor(item, store);
        const packageSize = parsePackageSizeFromText(item.name);
        const packages = packagesNeededForLine(item.quantity, item.unit, packageSize);
        const lineTotal = computeLineTotal(unitPrice, packages);
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
          priceSource: 'sample',
        });
      }
    }

    const storeTotals = pricedStores.map((store) => {
      const storeDeals = deals.filter((d) => d.storeId === store.id);
      const subtotal = storeDeals.reduce((sum, d) => sum + d.lineTotal, 0);
      return {
        storeId: store.id,
        subtotal: Math.round(subtotal * 100) / 100,
        itemCount: storeDeals.length,
        missingCount: Math.max(0, items.length - storeDeals.length),
        promoCount: storeDeals.filter((d) => d.promoLabel).length,
        pricesAvailable: true,
      };
    });

    const sorted = [...storeTotals].sort((a, b) => a.subtotal - b.subtotal);
    const best = sorted[0];
    const bestStore = pricedStores.find((s) => s.id === best?.storeId);

    return {
      stores: pricedStores,
      deals,
      storeTotals,
      suggestion: {
        kind: 'single_store',
        label: bestStore ? `Best value: ${bestStore.chain}` : SMART_SHOP_COPY.estimatedPricesTitle,
        storeIds: best ? [best.storeId] : [],
        estimatedTotal: best?.subtotal ?? 0,
        note: undefined,
      },
    };
  },
};
