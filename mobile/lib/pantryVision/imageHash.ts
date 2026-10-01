/** Stable cache key for prepared pantry images (cross-platform). */
export async function sha256HexFromUtf8(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const data = new TextEncoder().encode(text);
    const digest = await subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return fallbackHashHex(text);
}

/** Hash the JPEG base64 payload (not URI) so identical uploads hit the same cache entry. */
export async function pantryImageContentHash(base64: string, mimeType: string): Promise<string> {
  const sample = base64.length > 256_000 ? base64.slice(0, 256_000) + `|len:${base64.length}` : base64;
  return sha256HexFromUtf8(`${mimeType}|${sample}`);
}

function fallbackHashHex(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}
