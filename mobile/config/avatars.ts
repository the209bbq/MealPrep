/** Profile avatars in Supabase Storage (`avatars` bucket). */

export const AVATARS = {
  bucketId: 'avatars',
  maxLongEdge: 512,
  jpegQuality: 0.85,
  maxBytes: 900_000,
  migrationFilePath: 'mobile/supabase/migrations/20261002143000_avatars_storage.sql',
  edgeDeleteAccountPath: 'mobile/supabase/functions/delete-user-account/index.ts',
} as const;

export function buildAvatarObjectPath(userId: string, timestampMs = Date.now()): string {
  return `${userId}/avatar-${timestampMs}.jpg`;
}
