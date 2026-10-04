import type { StoreLocation } from '../deals/types';
import { instacartStoreUrl } from '../smartShop/deliveryLinks';
import { resolveRetailerForStore } from '../smartShop/retailerLinks';
import { resolveOpenNowFromOsmHours } from './openingHours';
import type { StoreRecord } from './types';

export function resolveStorePhone(store: Pick<StoreLocation, 'phone'>): string | undefined {
  const raw = store.phone?.trim();
  if (!raw) return undefined;
  const digits = raw.replace(/[^\d+]/g, '');
  return digits.length >= 10 ? raw : undefined;
}

export function resolveStoreWebsiteUrl(
  store: Pick<StoreLocation, 'name' | 'chain' | 'website'>,
): string | undefined {
  const direct = store.website?.trim();
  if (direct && /^https?:\/\//i.test(direct)) return direct;
  if (direct) return `https://${direct.replace(/^\/\//, '')}`;
  const retailer = resolveRetailerForStore(store);
  return retailer?.listBrowseUrl;
}

export function resolveStoreDeliveryUrl(
  store: Pick<StoreLocation, 'name' | 'chain' | 'deliveryUrl'>,
): string | undefined {
  if (store.deliveryUrl?.trim()) return store.deliveryUrl.trim();
  return instacartStoreUrl(store);
}

export function resolveStoreOrderUrl(
  store: Pick<StoreLocation, 'name' | 'chain' | 'website' | 'deliveryUrl'>,
): { url: string; label: 'website' | 'order' } | undefined {
  const delivery = resolveStoreDeliveryUrl(store);
  if (delivery) return { url: delivery, label: 'order' };
  const website = resolveStoreWebsiteUrl(store);
  if (website) return { url: website, label: 'website' };
  return undefined;
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
