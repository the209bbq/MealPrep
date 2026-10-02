/** Postgres `uuid` primary keys on `grocery_list_items` (RFC 4122 string form). */
export const PERSISTED_GROCERY_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersistedGroceryUuid(id: string): boolean {
  return PERSISTED_GROCERY_UUID.test(id);
}

/** Client-side grocery row ids from `buildGroceryList` / manual adds — never sent to Supabase as `id`. */
export function isEphemeralGroceryListId(id: string): boolean {
  return id.startsWith('groc-') || id.startsWith('manual-');
}
