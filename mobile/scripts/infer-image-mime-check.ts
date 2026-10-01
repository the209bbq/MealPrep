/**
 * Unit checks for web image MIME inference (camera roll empty `File.type`).
 * Run from mobile/: npm run test:prepare-image-web
 */

import { inferImageMimeType, isHeicMimeType } from '../lib/web/inferImageMimeType';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function file(name: string, type: string): Pick<File, 'name' | 'type'> {
  return { name, type };
}

function main(): void {
  assert(inferImageMimeType(file('IMG_001.HEIC', '')) === 'image/heic', 'HEIC extension');
  assert(inferImageMimeType(file('photo.heif', '')) === 'image/heic', 'HEIF extension');
  assert(inferImageMimeType(file('snap.jpg', '')) === 'image/jpeg', 'jpg extension');
  assert(inferImageMimeType(file('snap.jpeg', '')) === 'image/jpeg', 'jpeg extension');
  assert(inferImageMimeType(file('x.png', '')) === 'image/png', 'png extension');
  assert(inferImageMimeType(file('x.webp', '')) === 'image/webp', 'webp extension');
  assert(inferImageMimeType(file('x.bin', 'image/png')) === 'image/png', 'preserve type');
  assert(inferImageMimeType(file('x.jpg', 'application/octet-stream')) === 'image/jpeg', 'octet-stream fallback');
  assert(isHeicMimeType('image/heic') && isHeicMimeType('image/heif'), 'heic detector');
  assert(!isHeicMimeType('image/jpeg'), 'not heic');

  console.log('infer-image-mime-check: OK');
}

main();
