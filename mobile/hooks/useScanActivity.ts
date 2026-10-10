import { useSyncExternalStore } from 'react';
import { getScanActivity, subscribeScanActivity, type ScanActivity } from '../lib/pantry/scanActivity';

/** Live count of background pantry scans and whether a result list is waiting. */
export function useScanActivity(): ScanActivity {
  return useSyncExternalStore(subscribeScanActivity, getScanActivity, getScanActivity);
}
