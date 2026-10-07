import type { PantryItem } from '../../types/mealprep';

export function isManualPantryLocalId(id: string): boolean {
  return id.startsWith('manual-');
}

export type ManualInsertCoordinatorState = {
  cancelledLocalIds: Set<string>;
};

export function createManualInsertCoordinator(): ManualInsertCoordinatorState {
  return { cancelledLocalIds: new Set() };
}

export function trackManualInsert(state: ManualInsertCoordinatorState, localId: string): void {
  state.cancelledLocalIds.delete(localId);
}

export function cancelManualInsert(state: ManualInsertCoordinatorState, localId: string): void {
  if (isManualPantryLocalId(localId)) {
    state.cancelledLocalIds.add(localId);
  }
}

export function isManualInsertCancelled(state: ManualInsertCoordinatorState, localId: string): boolean {
  return state.cancelledLocalIds.has(localId);
}

export function completeManualInsertTracking(state: ManualInsertCoordinatorState, localId: string): void {
  state.cancelledLocalIds.delete(localId);
}

export function mergeSavedManualPantryItem(
  pantry: PantryItem[],
  localId: string,
  saved: PantryItem,
  cancelled: boolean,
): { pantry: PantryItem[]; shouldDeleteServerId: string | null } {
  if (cancelled || !pantry.some((row) => row.id === localId)) {
    return { pantry, shouldDeleteServerId: saved.id };
  }
  return {
    pantry: pantry.map((row) => (row.id === localId ? saved : row)),
    shouldDeleteServerId: null,
  };
}

export function rollbackManualPantryItem(pantry: PantryItem[], localId: string): PantryItem[] {
  return pantry.filter((row) => row.id !== localId);
}
