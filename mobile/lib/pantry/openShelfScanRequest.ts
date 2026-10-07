/** One-shot signal: Pantry screen should open shelf scan when focused. */
export type PantryShelfScanOpenMode = 'menu' | 'camera';

let pendingOpenShelfScan: PantryShelfScanOpenMode | null = null;
let pendingWebShelfScanFile: File | null = null;

const listeners = new Set<() => void>();

function notifyOpenPantryShelfScanListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeOpenPantryShelfScan(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestOpenPantryShelfScan(mode: PantryShelfScanOpenMode = 'menu'): void {
  pendingOpenShelfScan = mode;
  notifyOpenPantryShelfScanListeners();
}

export function stashPantryWebShelfScanFile(file: File): void {
  pendingWebShelfScanFile = file;
  notifyOpenPantryShelfScanListeners();
}

export function consumePantryWebShelfScanFile(): File | null {
  if (!pendingWebShelfScanFile) return null;
  const file = pendingWebShelfScanFile;
  pendingWebShelfScanFile = null;
  return file;
}

export function consumeOpenPantryShelfScanRequest(): PantryShelfScanOpenMode | null {
  if (!pendingOpenShelfScan) return null;
  const mode = pendingOpenShelfScan;
  pendingOpenShelfScan = null;
  return mode;
}
