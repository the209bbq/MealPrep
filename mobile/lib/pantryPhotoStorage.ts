/**
 * Only persist remote URLs in Supabase. Local preview URIs (data:, blob:, file:) are omitted
 * so batch inserts stay small and fast on web/PWA.
 */
export function pantryPhotoUrlForStorage(photoUri: string | null | undefined): string | null {
  if (!photoUri) return null;
  const trimmed = photoUri.trim();
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) return trimmed;
  return null;
}
