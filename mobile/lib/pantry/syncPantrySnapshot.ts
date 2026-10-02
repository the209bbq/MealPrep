import type { SupabaseClient } from '@supabase/supabase-js';
import type { PantryItem } from '../../types/mealprep';
import { deletePantryItemsByIds, insertPantryItem, updatePantryItem } from '../supabaseData';

/** Reconcile Supabase pantry rows to match a previous snapshot (undo). */
export async function syncPantryToSnapshot(
  client: SupabaseClient,
  userId: string,
  current: PantryItem[],
  snapshot: PantryItem[],
): Promise<void> {
  const currentIds = new Set(current.map((row) => row.id));
  const snapshotIds = new Set(snapshot.map((row) => row.id));
  const removedIds = [...currentIds].filter((id) => !snapshotIds.has(id));
  if (removedIds.length > 0) {
    await deletePantryItemsByIds(client, userId, removedIds);
  }

  for (const row of snapshot) {
    if (!currentIds.has(row.id)) {
      await insertPantryItem(client, userId, row);
      continue;
    }
    const before = current.find((r) => r.id === row.id);
    if (
      before &&
      (before.quantity !== row.quantity ||
        before.unit !== row.unit ||
        before.location !== row.location ||
        before.name !== row.name)
    ) {
      await updatePantryItem(client, userId, row);
    }
  }
}
