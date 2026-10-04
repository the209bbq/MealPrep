import { GROCERY_CHAINS, type DeliveryServiceId, type GroceryChainConfig } from '../../config/smartShopChains';
import { DELIVERY_URL_TEMPLATES, fillDeliveryTemplate } from '../../config/smartShopDelivery';
import { formatQuantityWithUnit } from '../formatQuantity';
import type { StoreLocation } from '../deals/types';

function haystack(store: Pick<StoreLocation, 'name' | 'chain'>): string {
  return `${store.name} ${store.chain}`.toLowerCase();
}

export function resolveGroceryChainForLocation(
  store: Pick<StoreLocation, 'name' | 'chain'>,
): GroceryChainConfig | null {
  const h = haystack(store);
  for (const chain of GROCERY_CHAINS) {
    if (chain.matchPatterns.some((p) => h.includes(p.toLowerCase()))) return chain;
  }
  return null;
}

const DEFAULT_DELIVERY_AVAILABLE = { instacart: true, doordash: true };

export function isDeliveryServiceAvailable(
  service: DeliveryServiceId,
  store: Pick<StoreLocation, 'name' | 'chain'>,
): boolean {
  const chain = resolveGroceryChainForLocation(store);
  if (!chain?.delivery) return DEFAULT_DELIVERY_AVAILABLE[service];
  if (service === 'instacart') {
    return chain.delivery.instacartAvailable ?? DEFAULT_DELIVERY_AVAILABLE.instacart;
  }
  return chain.delivery.doordashAvailable ?? DEFAULT_DELIVERY_AVAILABLE.doordash;
}

function deliverySearchLabel(store: Pick<StoreLocation, 'name' | 'chain'>): string {
  const chain = resolveGroceryChainForLocation(store);
  return chain?.delivery?.deliverySearchName ?? chain?.displayName ?? store.name;
}

export function instacartStoreUrl(store: Pick<StoreLocation, 'name' | 'chain'>): string {
  const chain = resolveGroceryChainForLocation(store);
  const slug = chain?.delivery?.instacartSlug;
  if (slug) {
    return fillDeliveryTemplate(DELIVERY_URL_TEMPLATES.instacart.slugTemplate!, slug);
  }
  const query = deliverySearchLabel(store);
  return fillDeliveryTemplate(DELIVERY_URL_TEMPLATES.instacart.searchTemplate, query);
}

export function doordashStoreUrl(store: Pick<StoreLocation, 'name' | 'chain'>): string {
  const query = deliverySearchLabel(store);
  return fillDeliveryTemplate(DELIVERY_URL_TEMPLATES.doordash.searchTemplate, query);
}

export function deliveryListOrderUrl(service: DeliveryServiceId): string {
  return DELIVERY_URL_TEMPLATES[service].listOrderTemplate;
}

export function formatGroceryListPlainText(
  items: ReadonlyArray<{ name: string; quantity: number; unit: string }>,
): string {
  return items
    .map((i) => `${i.name} — ${formatQuantityWithUnit(i.quantity, i.unit)}`.trim())
    .join('\n');
}
