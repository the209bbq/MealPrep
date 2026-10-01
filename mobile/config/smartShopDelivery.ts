import type { DeliveryServiceId } from './smartShopChains';

/**
 * Delivery deep-link templates (no API keys, no cart writes).
 *
 * Verification notes (2026-10-01, Cloud Agent VM):
 * - Instacart and DoorDash return 401/403 to automated HTTP clients; templates match
 *   documented in-app / marketing URL shapes and open correctly in a browser.
 */
export const DELIVERY_URL_TEMPLATES = {
  instacart: {
    label: 'Order on Instacart',
    /** Keyword search when no slug: https://www.instacart.com/store/s?k=... */
    searchTemplate: 'https://www.instacart.com/store/s?k={query}',
    /** Known chain: https://www.instacart.com/store/{slug} */
    slugTemplate: 'https://www.instacart.com/store/{slug}',
    /** After copying the grocery list — broad grocery search. */
    listOrderTemplate: 'https://www.instacart.com/store/s?k=grocery',
  },
  doordash: {
    label: 'Order on DoorDash',
    /** https://www.doordash.com/search/store/{name}/ */
    searchTemplate: 'https://www.doordash.com/search/store/{query}/',
    listOrderTemplate: 'https://www.doordash.com/search/store/grocery/',
  },
} as const satisfies Record<
  DeliveryServiceId,
  {
    label: string;
    searchTemplate: string;
    listOrderTemplate: string;
    slugTemplate?: string;
  }
>;

export const DELIVERY_CLIPBOARD_TOAST = 'List copied — paste into search';

export function fillDeliveryTemplate(template: string, query: string): string {
  return template.replace('{query}', encodeURIComponent(query));
}
