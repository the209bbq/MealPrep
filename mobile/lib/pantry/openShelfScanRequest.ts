/** One-shot signal: Pantry screen should open shelf scan when focused. */
export type PantryShelfScanOpenMode = 'menu' | 'camera';

let pendingOpenShelfScan: PantryShelfScanOpenMode | null = null;

const listeners = new Set<() => void>();

export function subscribeOpenPantryShelfScan(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestOpenPantryShelfScan(mode: PantryShelfScanOpenMode = 'menu'): void {
  pendingOpenShelfScan = mode;
  for (const listener of listeners) {
    listener();
  }
}

export function consumeOpenPantryShelfScanRequest(): PantryShelfScanOpenMode | null {
  if (!pendingOpenShelfScan) return null;
  const mode = pendingOpenShelfScan;
  pendingOpenShelfScan = null;
  return mode;
}
