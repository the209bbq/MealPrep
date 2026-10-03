export const SCAN_CORRECTION_KINDS = ['rename', 'removed', 'added'] as const;
export type ScanCorrectionKind = (typeof SCAN_CORRECTION_KINDS)[number];

export const SCAN_CORRECTIONS = {
  table: 'scan_corrections',
  migrationFilePath: 'mobile/supabase/migrations/20261002210000_scan_corrections.sql',
  adminSummaryRpc: 'admin_scan_corrections_summary',
  defaultSummaryDays: 30,
} as const;

export const SCAN_CORRECTIONS_UI = {
  missedAnythingLabel: 'Did I miss anything?',
  sharePhotoToggleLabel: 'Share this photo to help improve the scanner',
  addMissedPlaceholder: 'Item name',
  addMissedButton: 'Add to list',
} as const;
