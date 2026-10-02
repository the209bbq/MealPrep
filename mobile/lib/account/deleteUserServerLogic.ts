/**
 * Shared account-deletion helpers (Edge Function + regression tests).
 * Keep storage listing in sync with `supabase/functions/delete-user-account/index.ts`.
 */

export const USER_STORAGE_BUCKETS = ['avatars', 'scan-photos'] as const;

export type StorageListEntry = {
  name: string;
  id: string | null;
};

/** Reject path traversal and paths outside the user's folder. */
export function isSafeUserStoragePath(objectPath: string, userId: string): boolean {
  const normalized = objectPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) return false;
  const prefix = `${userId}/`;
  return normalized === userId || normalized.startsWith(prefix);
}

/**
 * Flatten one level of Supabase Storage `list()` results into file paths and child folder prefixes.
 * Folders are entries with `id === null`.
 */
export function collectPathsFromListPage(
  userId: string,
  folderPrefix: string,
  entries: StorageListEntry[],
): { filePaths: string[]; childFolderPrefixes: string[] } {
  const filePaths: string[] = [];
  const childFolderPrefixes: string[] = [];
  const base = folderPrefix ? folderPrefix.replace(/\/$/, '') : userId;

  if (!isSafeUserStoragePath(base, userId)) {
    return { filePaths, childFolderPrefixes };
  }

  for (const entry of entries) {
    if (!entry.name) continue;
    const fullPath = base ? `${base}/${entry.name}` : entry.name;
    if (!isSafeUserStoragePath(fullPath, userId)) continue;

    if (entry.id === null) {
      childFolderPrefixes.push(fullPath);
    } else {
      filePaths.push(fullPath);
    }
  }

  return { filePaths, childFolderPrefixes };
}

/** Depth-first accumulation of object paths under `{userId}/` (testable without network). */
export function flattenStorageTree(
  userId: string,
  listPages: Record<string, StorageListEntry[]>,
): string[] {
  const files: string[] = [];
  const queue = [userId];

  while (queue.length > 0) {
    const folder = queue.shift()!;
    const entries = listPages[folder] ?? [];
    const { filePaths, childFolderPrefixes } = collectPathsFromListPage(userId, folder, entries);
    files.push(...filePaths);
    queue.push(...childFolderPrefixes);
  }

  return files.filter((path) => isSafeUserStoragePath(path, userId));
}
