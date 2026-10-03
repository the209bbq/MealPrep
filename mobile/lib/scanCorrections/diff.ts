import type { PantryStorageLocation } from '../../config/pantryStorage';
import type { ScanCorrectionKind } from '../../config/scanCorrections';
import type { PantryScanReviewItem } from '../pantryVision/types';
import { scanCorrectionNamesDiffer } from './normalize';
import type { ScanCorrectionBaselineEntry, ScanCorrectionRow } from './types';

export interface BuildScanCorrectionsInput {
  scanId: string;
  model: string | null | undefined;
  baseline: ReadonlyMap<string, ScanCorrectionBaselineEntry>;
  finalItems: PantryScanReviewItem[];
  trainingPhotoPath: string | null;
}

function rowBase(
  scanId: string,
  model: string | null | undefined,
  trainingPhotoPath: string | null,
  location: PantryStorageLocation | null,
): Pick<ScanCorrectionRow, 'scan_id' | 'model' | 'training_photo_path' | 'storage_location'> {
  return {
    scan_id: scanId,
    model: model?.trim() || null,
    training_photo_path: trainingPhotoPath,
    storage_location: location,
  };
}

export function buildScanCorrectionRows(input: BuildScanCorrectionsInput): ScanCorrectionRow[] {
  const { scanId, model, baseline, finalItems, trainingPhotoPath } = input;
  const finalByKey = new Map(finalItems.map((item) => [item.key, item]));
  const rows: ScanCorrectionRow[] = [];

  for (const [key, { aiName }] of baseline) {
    const final = finalByKey.get(key);
    const location = final?.location ?? null;
    const base = rowBase(scanId, model, trainingPhotoPath, location);

    if (!final || !final.enabled) {
      rows.push({
        ...base,
        kind: 'removed',
        ai_name: aiName,
        user_name: null,
      });
      continue;
    }

    if (scanCorrectionNamesDiffer(aiName, final.name)) {
      rows.push({
        ...base,
        kind: 'rename',
        ai_name: aiName,
        user_name: final.name.trim(),
      });
    }
  }

  for (const item of finalItems) {
    if (!item.addedManually || !item.enabled || !item.name.trim()) continue;
    rows.push({
      ...rowBase(scanId, model, trainingPhotoPath, item.location),
      kind: 'added',
      ai_name: null,
      user_name: item.name.trim(),
    });
  }

  return rows;
}

export function countScanCorrectionsByKind(rows: ScanCorrectionRow[]): Record<ScanCorrectionKind, number> {
  const counts: Record<ScanCorrectionKind, number> = { rename: 0, removed: 0, added: 0 };
  for (const row of rows) {
    counts[row.kind] += 1;
  }
  return counts;
}
