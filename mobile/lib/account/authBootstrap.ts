import { readLastAccountUserId, readSupabasePersistedAuthUserId } from './lastAccountUser';

/** True when local storage still holds a Supabase session or last signed-in user id. */
export function hasLikelyStoredAuthSession(): boolean {
  return Boolean(readSupabasePersistedAuthUserId() || readLastAccountUserId());
}
