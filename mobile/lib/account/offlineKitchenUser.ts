import type { Session } from '@supabase/supabase-js';
import { readAccountKitchenCache } from './accountKitchenCache';
import { readLastAccountUserId, readSupabasePersistedAuthUserId } from './lastAccountUser';
import { isOffline } from '../network/isOffline';

/**
 * When the access token cannot refresh offline, keep showing the last signed-in kitchen
 * if we still have a local cache for that user.
 */
export function resolveOfflineKitchenUserId(session: Session | null): string | null {
  if (session?.user?.id) return session.user.id;
  if (!isOffline()) return null;

  const candidates = [
    readLastAccountUserId(),
    readSupabasePersistedAuthUserId(),
  ].filter((id): id is string => Boolean(id));

  for (const userId of candidates) {
    if (readAccountKitchenCache(userId)) return userId;
  }
  return null;
}
