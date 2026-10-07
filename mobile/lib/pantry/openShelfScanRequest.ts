/** One-shot signal: Pantry screen should open the shelf scan entry when focused. */
let pendingOpenShelfScan = false;

const listeners = new Set<() => void>();

export function subscribeOpenPantryShelfScan(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestOpenPantryShelfScan(): void {
  pendingOpenShelfScan = true;
  for (const listener of listeners) {
    listener();
  }
}

export function consumeOpenPantryShelfScanRequest(): boolean {
  if (!pendingOpenShelfScan) return false;
  pendingOpenShelfScan = false;
  return true;
}
