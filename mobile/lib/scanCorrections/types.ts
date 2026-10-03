import type { PantryStorageLocation } from '../../config/pantryStorage';
import type { ScanCorrectionKind } from '../../config/scanCorrections';

export interface ScanCorrectionRow {
  scan_id: string;
  kind: ScanCorrectionKind;
  ai_name: string | null;
  user_name: string | null;
  storage_location: PantryStorageLocation | null;
  model: string | null;
  training_photo_path: string | null;
}

export interface ScanCorrectionBaselineEntry {
  aiName: string;
}

export interface AdminScanCorrectionsSummary {
  days: number;
  counts: Partial<Record<ScanCorrectionKind, number>>;
  top_renames: { ai_name: string; user_name: string; count: number }[];
  training_photo_scans: number;
}
