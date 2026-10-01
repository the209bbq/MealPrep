/** Infer MIME type when the browser leaves `File.type` empty (common on mobile camera rolls). */
export function inferImageMimeType(file: Pick<File, 'name' | 'type'>): string {
  const trimmed = file.type?.trim().toLowerCase();
  if (trimmed && trimmed !== 'application/octet-stream') {
    return trimmed;
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'heic':
    case 'heif':
      return 'image/heic';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    default:
      return 'image/jpeg';
  }
}

export function isHeicMimeType(mimeType: string): boolean {
  const m = mimeType.toLowerCase();
  return m === 'image/heic' || m === 'image/heif';
}
