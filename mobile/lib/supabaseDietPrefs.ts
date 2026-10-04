import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeUserDietPrefs } from './diet/prefs';
import type { AllergenId, DietId, UserDietPrefs } from './diet/types';

type DietPrefsRow = {
  user_id: string;
  diets: string[] | null;
  allergens: string[] | null;
  dislikes: string[] | null;
  hide_conflicts: boolean | null;
  updated_at: string;
};

function rowToPrefs(row: DietPrefsRow): UserDietPrefs {
  return normalizeUserDietPrefs({
    diets: (row.diets ?? []) as DietId[],
    allergens: (row.allergens ?? []) as AllergenId[],
    dislikes: row.dislikes ?? [],
    hideConflicts: row.hide_conflicts ?? true,
  });
}

export async function fetchUserDietPrefs(
  client: SupabaseClient,
  userId: string,
): Promise<UserDietPrefs | null> {
  const { data, error } = await client
    .from('user_diet_prefs')
    .select('user_id, diets, allergens, dislikes, hide_conflicts, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    if (error.code === 'PGRST205' || error.message.includes('user_diet_prefs')) {
      return null;
    }
    throw error;
  }
  if (!data) return null;
  return rowToPrefs(data as DietPrefsRow);
}

export async function upsertUserDietPrefs(
  client: SupabaseClient,
  userId: string,
  prefs: UserDietPrefs,
): Promise<UserDietPrefs> {
  const normalized = normalizeUserDietPrefs(prefs);
  const payload = {
    user_id: userId,
    diets: normalized.diets,
    allergens: normalized.allergens,
    dislikes: normalized.dislikes,
    hide_conflicts: normalized.hideConflicts,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await client
    .from('user_diet_prefs')
    .upsert(payload, { onConflict: 'user_id' })
    .select('user_id, diets, allergens, dislikes, hide_conflicts, updated_at')
    .single();
  if (error) throw error;
  return rowToPrefs(data as DietPrefsRow);
}
