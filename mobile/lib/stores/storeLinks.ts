import { resolveStoreChainConfig } from '../../config/storeChains';
import { fillDeliveryTemplate } from '../../config/smartShopDelivery';
import type { StoreLocation } from '../deals/types';
import { instacartStoreUrl, doordashStoreUrl } from '../smartShop/deliveryLinks';
import { resolveOpenNowFromOsmHours } from './openingHours';
import type { StoreRecord } from './types';

export function resolveStorePhone(store: Pick<StoreLocation, 'phone'>): string | undefined {
  const raw = store.phone?.trim();
  if (!raw) return undefined;
  const digits = raw.replace(/[^\d+]/g, '');
  return digits.length >= 10 ? raw : undefined;
}

function storeSearchQuery(store: Pick<StoreLocation, 'name' | 'chain' | 'addressLine' | 'city' | 'state' | 'zip'>): string {
  return [store.chain || store.name, store.addressLine, store.city, store.state, store.zip].filter(Boolean).join(' ');
}

function fillStorePageTemplate(template: string, store: Pick<StoreLocation, 'name' | 'chain' | 'addressLine' | 'city' | 'state' | 'zip'>): string {
  const zip = store.zip?.trim().slice(0, 5) ?? '';
  const query = storeSearchQuery(store);
  return template
    .replace(/\{zip\}/g, encodeURIComponent(zip))
    .replace(/\{city\}/g, encodeURIComponent(store.city ?? ''))
    .replace(/\{state\}/g, encodeURIComponent(store.state ?? ''))
    .replace(/\{query\}/g, encodeURIComponent(query));
}

export function googleMapsPlaceSearchUrl(
  store: Pick<StoreLocation, 'name' | 'chain' | 'addressLine' | 'city' | 'state' | 'zip' | 'lat' | 'lng'>,
): string {
  const q = encodeURIComponent(storeSearchQuery(store));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function resolveStorePageUsesGoogleMaps(
  store: Pick<StoreLocation, 'name' | 'chain' | 'krogerLocationId' | 'pricingSource'>,
): boolean {
  const chain = resolveStoreChainConfig(store);
  return !chain?.storePageUrl;
}

export function resolveStorePageUrl(
  store: Pick<
    StoreLocation,
    'name' | 'chain' | 'addressLine' | 'city' | 'state' | 'zip' | 'lat' | 'lng' | 'website' | 'krogerLocationId' | 'pricingSource'
  >,
): string {
  const chain = resolveStoreChainConfig(store);
  if (chain?.storePageUrl) {
    return fillStorePageTemplate(chain.storePageUrl, store);
  }

  return googleMapsPlaceSearchUrl(store);
}

export type WeeklyAdLink = {
  url: string;
  thirdParty?: boolean;
};

export function resolveWeeklyAdLink(
  store: Pick<StoreLocation, 'name' | 'chain' | 'krogerLocationId' | 'pricingSource'>,
): WeeklyAdLink | undefined {
  const chain = resolveStoreChainConfig(store);
  if (!chain?.weeklyAdUrl) return undefined;
  return {
    url: chain.weeklyAdUrl,
    thirdParty: chain.weeklyAdIsThirdParty,
  };
}

export type StoreDeliveryServiceId = 'instacart' | 'doordash' | 'ubereats';

const UBER_EATS_SEARCH_TEMPLATE = 'https://www.uber.com/us/en/eats/search?q={query}';

export function uberEatsStoreUrl(store: Pick<StoreLocation, 'name' | 'chain'>): string {
  const chain = resolveStoreChainConfig(store);
  const label = chain?.delivery?.deliverySearchName ?? chain?.displayName ?? (store.chain || store.name);
  return fillDeliveryTemplate(UBER_EATS_SEARCH_TEMPLATE, label);
}

export function isStoreDeliveryServiceAvailable(
  service: StoreDeliveryServiceId,
  store: Pick<StoreLocation, 'name' | 'chain' | 'krogerLocationId' | 'pricingSource'>,
): boolean {
  const chain = resolveStoreChainConfig(store);
  const delivery = chain?.delivery;
  if (!delivery) return true;

  if (service === 'instacart') return delivery.instacart ?? true;
  if (service === 'doordash') return delivery.doordash ?? true;
  return delivery.ubereats ?? true;
}

export function storeDeliveryUrl(
  service: StoreDeliveryServiceId,
  store: Pick<StoreLocation, 'name' | 'chain' | 'krogerLocationId' | 'pricingSource'>,
): string {
  const chain = resolveStoreChainConfig(store);
  if (service === 'instacart') {
    const slug = chain?.delivery?.instacartSlug;
    if (slug) {
      return `https://www.instacart.com/store/${slug}`;
    }
    return instacartStoreUrl(store);
  }
  if (service === 'doordash') {
    return doordashStoreUrl(store);
  }
  return uberEatsStoreUrl(store);
}

export function storeRecordExtrasFromOsmTags(tags: Record<string, string>): Pick<
  StoreRecord,
  'phone' | 'website' | 'openingHours' | 'openNow'
> {
  const phone = tags.phone ?? tags['contact:phone'] ?? tags['contact:mobile'];
  const website = tags.website ?? tags['contact:website'];
  const openingHours = tags.opening_hours;
  const openNow = resolveOpenNowFromOsmHours(openingHours);
  return {
    phone: phone?.trim() || undefined,
    website: website?.trim() || undefined,
    openingHours: openingHours?.trim() || undefined,
    openNow,
  };
}
