/**
 * Pantry photo scans run in the background: the shopper can keep using the app, or add more
 * photos, while earlier ones are still with the model. This tiny store lets the tab bar show
 * that something is happening on the Pantry tab without the two screens knowing about each other.
 */

/** Photos that can be with the model at once. The server allows 12 scans a minute per account. */
export const MAX_PARALLEL_SCANS = 4;

export type ScanActivity = {
  /** Photos currently being scanned. */
  scanning: number;
  /** A list of found items is waiting on the Pantry tab for the shopper to check and save. */
  reviewReady: boolean;
};

let state: ScanActivity = { scanning: 0, reviewReady: false };
const listeners = new Set<() => void>();

function publish(next: ScanActivity): void {
  if (next.scanning === state.scanning && next.reviewReady === state.reviewReady) return;
  state = next;
  for (const listener of listeners) listener();
}

export function getScanActivity(): ScanActivity {
  return state;
}

export function subscribeScanActivity(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setScanningCount(count: number): void {
  publish({ ...state, scanning: Math.max(0, Math.floor(count)) });
}

export function setScanReviewReady(ready: boolean): void {
  publish({ ...state, reviewReady: ready });
}

export function resetScanActivity(): void {
  publish({ scanning: 0, reviewReady: false });
}

export function canStartAnotherScan(scanning: number, max: number = MAX_PARALLEL_SCANS): boolean {
  return scanning < max;
}

export type ScanResultPlacement = 'open-review' | 'merge-into-review' | 'nothing-found' | 'nothing-found-quiet';

/**
 * Where a finished photo's items go.
 * - A review list is already open: add the new items to it.
 * - No list open: open one with these items.
 * - Nothing found: say so, unless other photos are still scanning (their results may still come).
 */
export function placeScanResult(input: {
  reviewOpen: boolean;
  newItemCount: number;
  /** Photos still scanning, not counting this one. */
  othersScanning: number;
}): ScanResultPlacement {
  if (input.reviewOpen) return 'merge-into-review';
  if (input.newItemCount > 0) return 'open-review';
  return input.othersScanning > 0 ? 'nothing-found-quiet' : 'nothing-found';
}

/** Tab bar badge for the Pantry tab: "!" when a list is waiting, else the number still scanning. */
export function pantryTabBadge(activity: ScanActivity): string | number | undefined {
  if (activity.reviewReady) return '!';
  if (activity.scanning > 0) return activity.scanning;
  return undefined;
}
