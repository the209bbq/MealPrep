let pendingAisleCombine = false;

const listeners = new Set<() => void>();

export function subscribeGroceryAisleCombineRequest(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function requestGroceryAisleCombineView(): void {
  pendingAisleCombine = true;
  for (const listener of listeners) {
    listener();
  }
}

export function consumeGroceryAisleCombineRequest(): boolean {
  if (!pendingAisleCombine) return false;
  pendingAisleCombine = false;
  return true;
}
