import { SCAN_PHOTOS, scanPhotoFolderForKind, type ScanPhotoKind } from '../../config/scanPhotos';
import { isDemoMode } from '../../config/appConfig';
import { readJson, writeJson } from '../storage';
import { getSupabase } from '../supabase';

type StorageListItem = {
  name: string;
  id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

const SCAN_KINDS: ScanPhotoKind[] = ['pantry', 'price-tag'];

let cleanupInFlight: string | null = null;

function retentionCutoffMs(nowMs = Date.now()): number {
  return nowMs - SCAN_PHOTOS.retentionDays * 24 * 60 * 60 * 1000;
}

export function shouldRunClientScanPhotoCleanup(
  lastRunIso: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!lastRunIso?.trim()) return true;
  const last = Date.parse(lastRunIso);
  if (!Number.isFinite(last)) return true;
  return nowMs - last >= SCAN_PHOTOS.clientCleanupMinIntervalMs;
}

function readLastCleanupRuns(): Record<string, string> {
  return readJson<Record<string, string>>(SCAN_PHOTOS.clientCleanupStorageKey, {});
}

function writeLastCleanupRun(userId: string, iso: string): void {
  const map = readLastCleanupRuns();
  map[userId] = iso;
  writeJson(SCAN_PHOTOS.clientCleanupStorageKey, map);
}

function fullObjectPath(userId: string, kind: ScanPhotoKind, fileName: string): string {
  const folder = scanPhotoFolderForKind(kind);
  return `${userId}/${folder}/${fileName}`;
}

function objectCreatedAtMs(item: StorageListItem, objectPath: string): number | null {
  const fromMeta = item.created_at ?? item.updated_at;
  if (fromMeta) {
    const parsed = Date.parse(fromMeta);
    if (Number.isFinite(parsed)) return parsed;
  }
  const match = /\/(\d+)\.jpg$/i.exec(objectPath);
  if (match) {
    const ts = Number.parseInt(match[1], 10);
    if (Number.isFinite(ts)) return ts;
  }
  return null;
}

async function listFilesInScanFolder(
  userId: string,
  kind: ScanPhotoKind,
): Promise<{ path: string; createdAtMs: number | null }[]> {
  const client = getSupabase();
  if (!client) return [];

  const folder = `${userId}/${scanPhotoFolderForKind(kind)}`;
  const results: { path: string; createdAtMs: number | null }[] = [];
  const pageSize = 100;
  let offset = 0;

  for (;;) {
    const { data, error } = await client.storage.from(SCAN_PHOTOS.bucketId).list(folder, {
      limit: pageSize,
      offset,
      sortBy: { column: 'created_at', order: 'asc' },
    });
    if (error) {
      console.warn('[scan photo cleanup] list failed', folder, error.message);
      break;
    }
    if (!data?.length) break;

    for (const item of data as StorageListItem[]) {
      if (!item.name || item.name.endsWith('/')) continue;
      const path = fullObjectPath(userId, kind, item.name);
      results.push({ path, createdAtMs: objectCreatedAtMs(item, path) });
    }

    if (data.length < pageSize) break;
    offset += data.length;
  }

  return results;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function removeStoragePaths(paths: string[]): Promise<void> {
  const client = getSupabase();
  if (!client || paths.length === 0) return;

  for (const batch of chunk(paths, 50)) {
    const { error } = await client.storage.from(SCAN_PHOTOS.bucketId).remove(batch);
    if (error) {
      console.warn('[scan photo cleanup] remove failed', error.message);
    }
  }
}

async function clearDbPathsForUser(userId: string, paths: string[]): Promise<void> {
  const client = getSupabase();
  if (!client || paths.length === 0) return;

  for (const batch of chunk(paths, 40)) {
    const pantry = await client
      .from('pantry_items')
      .update({ scan_photo_path: null })
      .eq('user_id', userId)
      .in('scan_photo_path', batch);
    if (pantry.error) {
      console.warn('[scan photo cleanup] pantry path clear failed', pantry.error.message);
    }

    const deals = await client
      .from('store_deals')
      .update({ scan_photo_path: null })
      .eq('reported_by', userId)
      .in('scan_photo_path', batch);
    if (deals.error) {
      console.warn('[scan photo cleanup] deal path clear failed', deals.error.message);
    }
  }
}

async function runScanPhotoRetentionCleanup(userId: string): Promise<void> {
  const cutoff = retentionCutoffMs();
  const toRemove: string[] = [];

  for (const kind of SCAN_KINDS) {
    const listed = await listFilesInScanFolder(userId, kind);
    for (const file of listed) {
      if (file.createdAtMs === null) continue;
      if (file.createdAtMs < cutoff) {
        toRemove.push(file.path);
      }
    }
  }

  if (toRemove.length === 0) return;

  await removeStoragePaths(toRemove);
  await clearDbPathsForUser(userId, toRemove);
}

/**
 * Fire-and-forget retention pass (signed-in users only). Never throws.
 */
export function runScanPhotoRetentionCleanupIfDue(userId: string | null | undefined): void {
  const id = userId?.trim();
  if (!id || isDemoMode()) return;
  if (cleanupInFlight === id) return;

  const runs = readLastCleanupRuns();
  const lastRun = runs[id];
  if (!shouldRunClientScanPhotoCleanup(lastRun)) return;

  cleanupInFlight = id;
  writeLastCleanupRun(id, new Date().toISOString());

  void runScanPhotoRetentionCleanup(id)
    .catch((error) => {
      console.warn('[scan photo cleanup]', error instanceof Error ? error.message : error);
    })
    .finally(() => {
      if (cleanupInFlight === id) cleanupInFlight = null;
    });
}
