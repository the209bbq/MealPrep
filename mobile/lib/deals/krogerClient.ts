import { getKrogerProxyUrl, SMART_SHOP, SUPABASE_ANON_KEY } from '../../config/appConfig';
import type { StoreLocation } from './types';

export interface KrogerProxyStoreRow {
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

interface KrogerProxyResponse {
  stores?: KrogerProxyStoreRow[];
  result?: Omit<import('./types').DealsSearchResult, 'mode' | 'providerId' | 'providerLabel' | 'pricingNote'>;
  configured?: boolean;
  error?: string;
}

export async function callKrogerProxy(body: Record<string, unknown>): Promise<KrogerProxyResponse> {
  const url = getKrogerProxyUrl();
  if (!url) throw new Error('Kroger proxy URL is not configured');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const anon = SUPABASE_ANON_KEY.trim();
  if (anon) headers.Authorization = `Bearer ${anon}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as KrogerProxyResponse;
  if (response.status === 503) {
    return { ...payload, configured: false, error: payload.error ?? 'Kroger not configured' };
  }
  if (!response.ok) {
    throw new Error(payload.error ?? `Kroger proxy failed (${response.status})`);
  }
  return payload;
}

export function toKrogerStoreLocation(store: StoreLocation): StoreLocation {
  return {
    ...store,
    id: store.krogerLocationId ?? store.id,
  };
}
