/** Infer MIME type when the browser leaves `File.type` empty (common on Android camera rolls). */
export function inferImageMimeType(file: Pick<File, 'name' | 'type'>): string {
  const trimmed = file.type?.trim().toLowerCase();
  if (trimmed && trimmed !== 'application/octet-stream' && trimmed !== 'image/*') {
    return trimmed;
  }

  const ext = extensionFromName(file.name);
  return mimeFromExtension(ext);
}

function extensionFromName(name: string): string | undefined {
  const base = name.split(/[/\\]/).pop() ?? name;
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) {
    return undefined;
  }
  return base.slice(dot + 1).toLowerCase();
}

function mimeFromExtension(ext: string | undefined): string {
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

/** Sniff magic bytes when name/type are unreliable (Android content:// picks). */
export function inferImageMimeTypeFromHeader(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  if (bytes.length >= 12) {
    const ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    if (ftyp === 'ftyp') {
      const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
      if (brand.startsWith('heic') || brand.startsWith('heif') || brand === 'mif1' || brand === 'msf1') {
        return 'image/heic';
      }
    }
  }
  return null;
}

export async function resolveImageMimeType(file: File): Promise<string> {
  const trimmed = file.type?.trim().toLowerCase();
  if (trimmed && trimmed !== 'application/octet-stream' && trimmed !== 'image/*') {
    return trimmed;
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const sniffed = inferImageMimeTypeFromHeader(header);
  if (sniffed) return sniffed;

  return inferImageMimeType(file);
}

export function isHeicMimeType(mimeType: string): boolean {
  const m = mimeType.toLowerCase();
  return m === 'image/heic' || m === 'image/heif';
}
