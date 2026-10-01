import { COMMUNITY_DEALS } from '../../config/communityDeals';
import { localDateString } from './localDate';

export type CommunityPriceKind = 'regular' | 'sale';

export function defaultRegularValidUntil(from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + COMMUNITY_DEALS.regularPriceValidDays);
  return localDateString(d);
}

export function resolvePriceValidity(input: {
  saleValidUntil?: string | null;
}): { priceKind: CommunityPriceKind; validUntil: string } {
  const saleUntil = input.saleValidUntil?.trim();
  if (saleUntil) {
    return { priceKind: 'sale', validUntil: saleUntil };
  }
  return { priceKind: 'regular', validUntil: defaultRegularValidUntil() };
}
