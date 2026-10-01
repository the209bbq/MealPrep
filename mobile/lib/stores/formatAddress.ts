import type { StoreLocation } from '../deals/types';

const PLACEHOLDER_STREET = /^address not listed$/i;

function hasStreetAddress(addressLine: string | undefined): boolean {
  const street = addressLine?.trim();
  return Boolean(street && !PLACEHOLDER_STREET.test(street));
}

/** User-facing store address (street when known, otherwise city + ZIP). */
export function formatStoreAddress(store: Pick<StoreLocation, 'addressLine' | 'city' | 'state' | 'zip'>): string {
  if (hasStreetAddress(store.addressLine)) {
    const cityLine = [store.city, store.state].filter(Boolean).join(' ');
    const zipSuffix = store.zip ? ` ${store.zip}` : '';
    if (cityLine) return `${store.addressLine}, ${cityLine}${zipSuffix}`;
    return `${store.addressLine}${zipSuffix}`.trim();
  }

  const place = [store.city, store.state].filter(Boolean).join(', ');
  if (place && store.zip) return `${place} ${store.zip}`;
  if (store.zip) return store.zip.trim();
  return place;
}
