import { isDemoMode } from '../../config/appConfig';
import { SCAN_CORRECTIONS } from '../../config/scanCorrections';
import { buildScanTrainingObjectPath, SCAN_TRAINING } from '../../config/scanTraining';
import { getSupabase } from '../supabase';
import type { PreparedPantryImage } from '../pantryVision/types';
import type { ScanCorrectionRow } from './types';

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Fire-and-forget batch insert; never throws to callers. */
export function logScanCorrectionsInBackground(rows: ScanCorrectionRow[]): void {
  if (rows.length === 0 || isDemoMode()) return;

  const client = getSupabase();
  if (!client) return;

  void (async () => {
    try {
      const { error } = await client.from(SCAN_CORRECTIONS.table).insert(rows);
      if (error) {
        console.warn('[scan corrections] insert failed', error.message);
      }
    } catch (error: unknown) {
      console.warn('[scan corrections] insert failed', error instanceof Error ? error.message : error);
    }
  })();
}

/**
 * Upload opt-in training photo. Returns storage path or null. Never throws.
 */
export async function uploadScanTrainingPhoto(
  prepared: PreparedPantryImage,
  userId: string,
  scanId: string,
): Promise<string | null> {
  if (isDemoMode()) return null;

  const client = getSupabase();
  if (!client || !userId || !scanId.trim()) return null;

  const path = buildScanTrainingObjectPath(userId, scanId);
  try {
    const body = base64ToUint8Array(prepared.base64);
    const { error } = await client.storage.from(SCAN_TRAINING.bucketId).upload(path, body, {
      contentType: prepared.mimeType,
      upsert: false,
    });
    if (error) {
      console.warn('[scan training] upload failed', error.message);
      return null;
    }
    return path;
  } catch (error) {
    console.warn('[scan training] upload failed', error instanceof Error ? error.message : error);
    return null;
  }
}

/** Upload training photo without blocking save; resolves path for correction rows. */
export function uploadScanTrainingPhotoInBackground(
  prepared: PreparedPantryImage,
  userId: string,
  scanId: string,
  onPath: (path: string | null) => void,
): void {
  void uploadScanTrainingPhoto(prepared, userId, scanId).then(onPath);
}
