import {
  buildScanPhotoObjectPath,
  SCAN_PHOTOS,
  type ScanPhotoKind,
} from '../../config/scanPhotos';
import { isDemoMode } from '../../config/appConfig';
import { getSupabase } from '../supabase';
import type { PreparedPantryImage } from '../pantryVision/types';

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Upload a compressed scan image. Returns the storage object path, or null on failure.
 * Never throws — scan flows should continue if upload fails.
 */
export async function uploadScanPhoto(
  prepared: PreparedPantryImage,
  kind: ScanPhotoKind,
  userId: string,
): Promise<string | null> {
  if (isDemoMode()) return null;

  const client = getSupabase();
  if (!client || !userId) return null;

  const path = buildScanPhotoObjectPath(userId, kind);
  try {
    const body = base64ToUint8Array(prepared.base64);
    const { error } = await client.storage.from(SCAN_PHOTOS.bucketId).upload(path, body, {
      contentType: prepared.mimeType,
      upsert: false,
    });
    if (error) {
      console.warn('[scan photo] upload failed', error.message);
      return null;
    }
    return path;
  } catch (error) {
    console.warn('[scan photo] upload failed', error instanceof Error ? error.message : error);
    return null;
  }
}

/** Fire-and-forget upload; resolves when complete. */
export function uploadScanPhotoInBackground(
  prepared: PreparedPantryImage,
  kind: ScanPhotoKind,
  userId: string,
  onPath?: (path: string | null) => void,
): void {
  void uploadScanPhoto(prepared, kind, userId).then((path) => {
    onPath?.(path);
  });
}

export async function createScanPhotoSignedUrl(objectPath: string): Promise<string | null> {
  if (isDemoMode() || !objectPath.trim()) return null;

  const client = getSupabase();
  if (!client) return null;

  try {
    const { data, error } = await client.storage
      .from(SCAN_PHOTOS.bucketId)
      .createSignedUrl(objectPath, SCAN_PHOTOS.signedUrlTtlSeconds);
    if (error) {
      console.warn('[scan photo] signed url failed', error.message);
      return null;
    }
    return data?.signedUrl ?? null;
  } catch (error) {
    console.warn('[scan photo] signed url failed', error instanceof Error ? error.message : error);
    return null;
  }
}

/** Best-effort delete; never throws. */
export async function deleteScanPhoto(objectPath: string | null | undefined): Promise<void> {
  const trimmed = objectPath?.trim();
  if (!trimmed || isDemoMode()) return;

  const client = getSupabase();
  if (!client) return;

  try {
    const { error } = await client.storage.from(SCAN_PHOTOS.bucketId).remove([trimmed]);
    if (error) {
      console.warn('[scan photo] delete failed', error.message);
    }
  } catch (error) {
    console.warn('[scan photo] delete failed', error instanceof Error ? error.message : error);
  }
}
