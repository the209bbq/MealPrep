/**
 * Unit checks for web image MIME inference (Android camera roll empty `File.type`).
 * Run from mobile/: npm run test:prepare-image-web
 */
import {
  inferImageMimeType,
  inferImageMimeTypeFromHeader,
  isHeicMimeType,
  resolveImageMimeType,
} from '../lib/web/inferImageMimeType';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function file(name: string, type: string): Pick<File, 'name' | 'type'> {
  return { name, type };
}

const JPEG_HEADER = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

async function main(): Promise<void> {
  assert(inferImageMimeType(file('IMG_001.HEIC', '')) === 'image/heic', 'HEIC extension');
  assert(inferImageMimeType(file('photo.heif', '')) === 'image/heic', 'HEIF extension');
  assert(inferImageMimeType(file('snap.jpg', '')) === 'image/jpeg', 'jpg extension');
  assert(inferImageMimeType(file('x.png', '')) === 'image/png', 'png extension');
  assert(inferImageMimeType(file('x.webp', '')) === 'image/webp', 'webp extension');
  assert(inferImageMimeType(file('x.jpg', 'application/octet-stream')) === 'image/jpeg', 'octet-stream fallback');
  assert(inferImageMimeType(file('x.jpg', 'image/*')) === 'image/jpeg', 'image/* fallback');
  assert(
    inferImageMimeType(file('content://com.android.providers.media.documents/document/image%3A1234', '')) ===
      'image/jpeg',
    'empty Android content URI defaults to jpeg',
  );
  assert(inferImageMimeTypeFromHeader(JPEG_HEADER) === 'image/jpeg', 'jpeg header sniff');
  assert(!isHeicMimeType('image/jpeg'), 'jpeg is not heic');

  const jpegFile = new File([JPEG_HEADER, new Uint8Array(100)], 'content://media/picker/0', { type: '' });
  const resolved = await resolveImageMimeType(jpegFile);
  assert(resolved === 'image/jpeg', `resolveImageMimeType jpeg got ${resolved}`);
  assert(!isHeicMimeType(resolved), 'resolved jpeg must not trigger heic2any');

  console.log('infer-image-mime-check: OK');
}

void main();
