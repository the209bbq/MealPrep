import { getKrogerProxyUrl, SUPABASE_ANON_KEY } from '../../config/appConfig';
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

export interface KrogerProxyResponse {
  stores?: KrogerProxyStoreRow[];
  result?: Omit<import('./types').DealsSearchResult, 'mode' | 'providerId' | 'providerLabel' | 'pricingNote'>;
  configured?: boolean;
  error?: string;
}

export function isKrogerServerConfigured(payload: KrogerProxyResponse): boolean {
  return payload.configured !== false;
}

export async function callKrogerProxy(body: Record<string, unknown>): Promise<KrogerProxyResponse> {
  const url = getKrogerProxyUrl();
  if (!url) {
    return { configured: false, error: 'Kroger Edge Function URL is not available' };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const anon = SUPABASE_ANON_KEY.trim();
  if (anon) headers.Authorization = `Bearer ${anon}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    return { configured: false, error: 'Could not reach store pricing. Try again shortly.' };
  }

  let payload: KrogerProxyResponse;
  try {
    payload = (await response.json()) as KrogerProxyResponse;
  } catch {
    return { configured: false, error: 'Could not load store prices. Try again shortly.' };
  }

  if (response.status === 503) {
    return { ...payload, configured: false, error: payload.error ?? 'Live Kroger prices are not set up yet.' };
  }
  if (!response.ok) {
    throw new Error(payload.error ?? `Kroger proxy failed (${response.status})`);
  }
  return { ...payload, configured: payload.configured ?? true };
}

export async function fetchKrogerLocations(params: {
  lat?: number;
  lng?: number;
  zip?: string;
  radiusMiles?: number;
}): Promise<{ stores: KrogerProxyStoreRow[]; serverConfigured: boolean }> {
  if (!getKrogerProxyUrl()) {
    return { stores: [], serverConfigured: false };
  }

  const data = await callKrogerProxy({
    action: 'locations',
    lat: params.lat,
    lng: params.lng,
    zip: params.zip,
    radiusMiles: params.radiusMiles,
  });

  if (!isKrogerServerConfigured(data)) {
    return { stores: [], serverConfigured: false };
  }
  return { stores: data.stores ?? [], serverConfigured: true };
}

export function toKrogerStoreLocation(store: StoreLocation): StoreLocation {
  return {
    ...store,
    id: store.krogerLocationId ?? store.id,
  };
}
