import { getKrogerProxyUrl, isDemoMode } from '../../config/appConfig';
import { SMART_SHOP_COPY } from '../../config/smartShop';

/** Client can call the Edge Function whenever Supabase is configured (no Kroger env vars in the bundle). */
export function isKrogerProxyAvailable(): boolean {
  return !isDemoMode() && getKrogerProxyUrl().length > 0;
}

export const KROGER_NOT_CONFIGURED_NOTE = SMART_SHOP_COPY.noLiveStoresNearby;
