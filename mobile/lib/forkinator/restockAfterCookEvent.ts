import type { PantryItem } from '../../types/mealprep';

export type ForkinatorRestockAfterCookPayload = {
  nextPantry: PantryItem[];
  /** True when confirm meal made applied at least one pantry deduction. */
  pantryDeductionApplied: boolean;
};

let pending: ForkinatorRestockAfterCookPayload | null = null;
const listeners = new Set<() => void>();

export function subscribeForkinatorRestockAfterCook(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitForkinatorRestockAfterCook(payload: ForkinatorRestockAfterCookPayload): void {
  pending = payload;
  for (const listener of listeners) {
    listener();
  }
}

export function consumeForkinatorRestockAfterCook(): ForkinatorRestockAfterCookPayload | null {
  if (!pending) return null;
  const value = pending;
  pending = null;
  return value;
}
