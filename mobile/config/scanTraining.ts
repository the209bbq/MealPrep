/**
 * Opt-in pantry scan photos for scanner improvement (private; admin read only).
 */

export const SCAN_TRAINING = {
  bucketId: 'scan-training',
  folder: 'pantry',
  migrationFilePath: 'mobile/supabase/migrations/20261002210000_scan_corrections.sql',
} as const;

export function buildScanTrainingObjectPath(userId: string, scanId: string): string {
  const safeScanId = scanId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${userId}/${SCAN_TRAINING.folder}/${safeScanId}.jpg`;
}
