import { SMART_SHOP_STORES } from '../../config/smartShop';

function isWebRuntime(): boolean {
  return typeof document !== 'undefined';
}

/** Headers OSM APIs accept from native clients (browsers block custom User-Agent). */
export function osmRequestHeaders(): Record<string, string> {
  if (isWebRuntime()) {
    return { Accept: 'application/json' };
  }
  return {
    Accept: 'application/json',
    'User-Agent': SMART_SHOP_STORES.httpUserAgent,
  };
}

export function nominatimSearchParams(base: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams(base);
  if (isWebRuntime() || !params.has('email')) {
    params.set('email', SMART_SHOP_STORES.nominatimContactEmail);
  }
  return params;
}

export function isRateLimitedStatus(status: number): boolean {
  return status === 429 || status === 503 || status === 509;
}
