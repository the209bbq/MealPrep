/**
 * Scan photos saved for pantry and shelf-tag reads (private per account).
 */

export type ScanPhotoKind = 'pantry' | 'price-tag';

export const SCAN_PHOTOS = {
  bucketId: 'scan-photos',
  /** Object paths look like `<userId>/<folder>/<timestamp>.jpg`. */
  folders: {
    pantry: 'pantry',
    priceTag: 'price-tag',
  } satisfies Record<'pantry' | 'priceTag', string>,
  /** How long we keep scan photos before scheduled cleanup. */
  retentionDays: 30,
  /** Signed link lifetime when opening a saved photo. */
  signedUrlTtlSeconds: 60 * 60,
  migrationFilePath: 'mobile/supabase/migrations/20261001220000_scan_photos_storage.sql',
  viewPhotoLabel: 'View photo',
  openPhotoFailed: 'Could not open that photo. Try again later.',
  loadingPhoto: 'Opening photo…',
  /** Local persistence: last client cleanup run per signed-in user (ISO timestamps). */
  clientCleanupStorageKey: 'mealplanatic.scanPhotoCleanupLastRunByUser',
  /** At most one cleanup pass per user per calendar day (local device clock). */
  clientCleanupMinIntervalMs: 24 * 60 * 60 * 1000,
} as const;

export function scanPhotoFolderForKind(kind: ScanPhotoKind): string {
  return kind === 'pantry' ? SCAN_PHOTOS.folders.pantry : SCAN_PHOTOS.folders.priceTag;
}

export function buildScanPhotoObjectPath(userId: string, kind: ScanPhotoKind, timestampMs = Date.now()): string {
  const folder = scanPhotoFolderForKind(kind);
  return `${userId}/${folder}/${timestampMs}.jpg`;
}
