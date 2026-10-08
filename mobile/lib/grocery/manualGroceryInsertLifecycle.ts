import type { GroceryListItem } from '../../types/mealprep';
import { isPersistedGroceryUuid } from './persistIds';

export function isManualGroceryLocalId(id: string): boolean {
  return id.startsWith('manual-');
}

export type ManualGroceryInsertCoordinatorState = {
  cancelledLocalIds: Set<string>;
};

export function createManualGroceryInsertCoordinator(): ManualGroceryInsertCoordinatorState {
  return { cancelledLocalIds: new Set() };
}

export function trackManualGroceryInsert(state: ManualGroceryInsertCoordinatorState, localId: string): void {
  state.cancelledLocalIds.delete(localId);
}

export function cancelManualGroceryInsert(state: ManualGroceryInsertCoordinatorState, localId: string): void {
  if (isManualGroceryLocalId(localId)) {
    state.cancelledLocalIds.add(localId);
  }
}

export function isManualGroceryInsertCancelled(
  state: ManualGroceryInsertCoordinatorState,
  localId: string,
): boolean {
  return state.cancelledLocalIds.has(localId);
}

export function completeManualGroceryInsertTracking(
  state: ManualGroceryInsertCoordinatorState,
  localId: string,
): void {
  state.cancelledLocalIds.delete(localId);
}

export function mergeSavedManualGroceryItem(
  grocery: GroceryListItem[],
  localId: string,
  saved: GroceryListItem,
  cancelled: boolean,
): { grocery: GroceryListItem[]; shouldDeleteServerId: string | null } {
  if (cancelled || !grocery.some((row) => row.id === localId)) {
    return { grocery, shouldDeleteServerId: saved.id };
  }
  return {
    grocery: grocery.map((row) => (row.id === localId ? saved : row)),
    shouldDeleteServerId: null,
  };
}

export function rollbackManualGroceryItem(grocery: GroceryListItem[], localId: string): GroceryListItem[] {
  return grocery.filter((row) => row.id !== localId);
}

/** Rows safe to send through `replaceGroceryList` (skip in-flight manual-* optimistic lines). */
export function groceryListForServerSync(items: GroceryListItem[]): GroceryListItem[] {
  return items.filter((item) => !isManualGroceryLocalId(item.id) || isPersistedGroceryUuid(item.id));
}

/**
 * Like `groceryListForServerSync`, but resolved when the queued sync actually runs: a manual
 * row that was still local when the list was built is swapped for its saved server row, so a
 * full-list replace never deletes a manual add (e.g. Forky's restock) that finished saving in
 * the meantime (FK3-6).
 */
export function resolveGroceryListForServerSync(
  items: GroceryListItem[],
  savedManualByLocalId: ReadonlyMap<string, GroceryListItem>,
): GroceryListItem[] {
  const out: GroceryListItem[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    let row: GroceryListItem | undefined = item;
    if (isManualGroceryLocalId(item.id) && !isPersistedGroceryUuid(item.id)) {
      row = savedManualByLocalId.get(item.id);
    }
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

/** Keep in-flight manual rows when a full-list sync returns without them. */
export function mergeServerGroceryWithPendingManual(
  current: GroceryListItem[],
  persisted: GroceryListItem[],
): GroceryListItem[] {
  const pendingManual = current.filter(
    (row) => isManualGroceryLocalId(row.id) && !isPersistedGroceryUuid(row.id),
  );
  if (pendingManual.length === 0) return persisted;
  const persistedIds = new Set(persisted.map((row) => row.id));
  const stillPending = pendingManual.filter((row) => !persistedIds.has(row.id));
  if (stillPending.length === 0) return persisted;
  return [...persisted, ...stillPending].sort((a, b) => a.name.localeCompare(b.name));
}
