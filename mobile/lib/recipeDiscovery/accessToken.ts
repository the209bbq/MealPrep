import type { Session } from '@supabase/supabase-js';
import { isDemoMode, isSupabaseConfigured, SUPABASE_ANON_KEY } from '../../config/appConfig';

/**
 * Bearer token for the recipeapi-proxy Edge Function.
 * Signed-in users send their session JWT; guests send the publishable anon key (rate-limited server-side).
 */
export function getRecipeDiscoveryAccessToken(session: Session | null): string | null {
  if (isDemoMode()) return 'demo';
  if (session?.access_token) return session.access_token;
  if (isSupabaseConfigured()) return SUPABASE_ANON_KEY;
  return null;
}
