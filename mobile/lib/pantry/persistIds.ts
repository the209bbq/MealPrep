/** Postgres `uuid` primary keys on `pantry_items` (RFC 4122 string form). */
export const PERSISTED_ROW_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersistedRowUuid(id: string): boolean {
  return PERSISTED_ROW_UUID.test(id);
}
