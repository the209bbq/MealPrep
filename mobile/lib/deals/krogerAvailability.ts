import { getKrogerProxyUrl, isDemoMode } from '../../config/appConfig';

/** Client can call the Edge Function whenever Supabase is configured (no Kroger env vars in the bundle). */
export function isKrogerProxyAvailable(): boolean {
  return !isDemoMode() && getKrogerProxyUrl().length > 0;
}

export const KROGER_NOT_CONFIGURED_NOTE =
  'Kroger is not set up on Supabase yet (add KROGER_CLIENT_ID and KROGER_CLIENT_SECRET). Showing SAMPLE deals.';
