import { photoScanAccessState, type PhotoScanAccessInput } from '../plans/photoScanAccess';

/** True when pantry photo-scan gate can be decided from in-memory app state (no async session read). */
export function canSyncForkinatorWebCameraScan(input: PhotoScanAccessInput): boolean {
  return photoScanAccessState(input) === 'allowed';
}
