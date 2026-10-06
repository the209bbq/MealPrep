import { readJson, removeStorageKey, writeJson } from '../storage';

const LAST_ACCOUNT_USER_ID_KEY = 'mealprep.lastAccountUserId';

export function readLastAccountUserId(): string | null {
  const id = readJson<string | null>(LAST_ACCOUNT_USER_ID_KEY, null);
  return id && id.length > 0 ? id : null;
}

export function writeLastAccountUserId(userId: string): void {
  if (!userId) return;
  writeJson(LAST_ACCOUNT_USER_ID_KEY, userId);
}

export function clearLastAccountUserId(): void {
  removeStorageKey(LAST_ACCOUNT_USER_ID_KEY);
}

/** Read user id from Supabase auth localStorage when JS session state is empty but storage remains. */
export function readSupabasePersistedAuthUserId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.includes('auth-token')) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        user?: { id?: string };
        currentSession?: { user?: { id?: string } };
      };
      const userId = parsed.user?.id ?? parsed.currentSession?.user?.id ?? null;
      if (userId) return userId;
    } catch {
      continue;
    }
  }
  return null;
}
